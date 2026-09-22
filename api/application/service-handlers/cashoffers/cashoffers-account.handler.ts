import type { IDomainEvent, IEventHandler } from "@api/infrastructure/events/event-bus.interface"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductRepository, WhitelabelRepository, SubscriptionRepository } from "@api/lib/repositories"
import type { ProductData } from "@api/domain/types/product-data.types"
import type { Kysely } from "kysely"
import type { DB } from "@api/lib/db.d"
import { mapRoleV2ForTransition } from "@api/domain/services/role-mapper"
import { downgradeRoleV2For, resolveUserConfigRoleV2, resolveUserRoleV2 } from "@api/domain/services/role-v2"

/**
 * CashOffersAccountHandler
 *
 * Listens to subscription lifecycle events and manages CashOffers user accounts
 * according to product configuration (cashoffers.managed flag).
 *
 * When cashoffers.managed = false → skip all user API calls.
 */
export class CashOffersAccountHandler implements IEventHandler {
  constructor(
    private readonly userApiClient: IUserApiClient,
    private readonly logger: ILogger,
    private readonly productRepository?: ProductRepository,
    private readonly whitelabelRepository?: WhitelabelRepository,
    private readonly subscriptionRepository?: SubscriptionRepository,
    private readonly db?: Kysely<DB>,
  ) {}

  /**
   * Resolve whitelabel_id from product's whitelabel_code column.
   * Used when creating/updating users on the external CashOffers system.
   */
  private async resolveWhitelabelId(productId: number | undefined): Promise<number | undefined> {
    if (!productId || !this.productRepository || !this.whitelabelRepository) return undefined
    try {
      const product = await this.productRepository.findById(productId)
      if (!product?.whitelabel_code) return undefined
      const whitelabel = await this.whitelabelRepository.findByCode(product.whitelabel_code)
      return whitelabel?.whitelabel_id ?? undefined
    } catch {
      return undefined
    }
  }

  async handle(event: IDomainEvent): Promise<void> {
    // Errors must propagate: AdminAlertHandler wraps this handler and only
    // fires a critical alert when the inner handler throws. The InMemoryEventBus
    // isolates handler failures via Promise.allSettled, so re-throwing here
    // does NOT roll back the renewal or trigger a user-facing "payment failed"
    // email — it just routes the failure to the admin for manual action.
    switch (event.eventType) {
      case 'SubscriptionCreated':
        await this.handleCreated(event)
        break
      case 'SubscriptionRenewed':
        await this.handleRenewed(event)
        break
      case 'SubscriptionPaused':
      case 'SubscriptionDeactivated':
        await this.handleSuspension(event)
        break
      case 'SubscriptionCancelled':
        // A scheduled cancel-on-renewal emits SubscriptionCancelled with cancelOnRenewal:true at SCHEDULE
        // time — the user keeps their plan until renewal. The renewal cron re-emits it with
        // cancelOnRenewal:false when the period actually ends; only THEN do we suspend. Skipping the deferred
        // marker here stops the premature downgrade-to-SHELL at schedule time (defect #1542 / ledger #44).
        // The schedule-time event still fires so the "cancellation scheduled" email sends (email handler
        // branches on the same flag).
        if ((event.payload as { cancelOnRenewal?: boolean })?.cancelOnRenewal === true) break
        await this.handleSuspension(event)
        break
      case 'SubscriptionResumed':
        await this.handleResumed(event)
        break
      case 'SubscriptionUpgraded':
        await this.handleUpgraded(event)
        break
    }
  }

  private getProductData(event: IDomainEvent): ProductData | undefined {
    // Check metadata first (SubscriptionCreated, Renewed, Paused, Deactivated, Cancelled)
    if (event.metadata?.productData) {
      return event.metadata.productData as ProductData
    }
    // Then check payload (SubscriptionResumed has productData in payload)
    const payload = event.payload as any
    if (payload?.productData) {
      return payload.productData as ProductData
    }
    return undefined
  }

  private async handleCreated(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const userConfig = productData.cashoffers.user_config
    if (!userConfig) return

    const payload = event.payload as any
    const userId = payload.userId
    const email = payload.email
    const userWasCreated = payload.userWasCreated
    const whitelabelId = await this.resolveWhitelabelId(payload.productId)

    const roleV2 = resolveUserConfigRoleV2(userConfig)
    if (!roleV2) {
      this.logger.error('Product user_config names no role that can be resolved', undefined, {
        userId,
        productId: payload.productId,
        userConfig,
      })
      throw new Error('Product user_config names no resolvable role')
    }

    if (userWasCreated) {
      await this.userApiClient.createUser({
        email,
        role_v2: roleV2,
        whitelabel_id: whitelabelId,
      })
    } else {
      // Existing user: check if update needed
      const user = await this.userApiClient.getUser(userId)
      if (!user) return

      // The comparison is on `role_v2`, and that is the change, not a tidier way to spell the old
      // one. On `(role, is_premium)` this could not see an Express Offers Pro moving to Elite:
      // both sides read `AGENT` + premium, needsUpdate came out false, and the subscriber kept
      // paying $299 for the $49 tier with nothing anywhere reporting it.
      const needsUpdate = resolveUserRoleV2(user) !== roleV2 || user.whitelabel_id !== whitelabelId

      if (needsUpdate) {
        await this.userApiClient.updateUser(userId, {
          role_v2: roleV2,
          whitelabel_id: whitelabelId,
        })
      }
    }
  }

  private async handleRenewed(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const userConfig = productData.cashoffers.user_config
    if (!userConfig) return

    const payload = event.payload as any
    const userId = payload.userId

    const user = await this.userApiClient.getUser(userId)
    if (!user) return

    // Up is the product's call: a subscription starting or renewing sets the role from what was
    // bought (plan §9.5). Down is the white label's, which is why the suspension path below does
    // not read this.
    const roleV2 = resolveUserConfigRoleV2(userConfig)
    const needsUpdate = roleV2 !== null && resolveUserRoleV2(user) !== roleV2

    if (needsUpdate) {
      await this.userApiClient.updateUser(userId, {
        role_v2: roleV2,
      })
    }

    // If team plan, reactivate all team members on renewal
    await this.reactivateTeamMembers(event, userId, userConfig)
  }

  private async handleSuspension(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const payload = event.payload as any

    // A cancel-on-renewal is only *scheduled* here — the subscription stays active
    // until the period ends, so the account must not be downgraded yet. The actual
    // downgrade happens at renewal, where the event fires with cancelOnRenewal=false.
    if (event.eventType === 'SubscriptionCancelled' && payload.cancelOnRenewal === true) {
      this.logger.info('Skipping suspension for scheduled cancel-on-renewal', {
        userId: payload.userId,
        subscriptionId: payload.subscriptionId,
      })
      return
    }

    const userId = payload.userId

    // Resolve suspension strategy from user's whitelabel_id (source of truth)
    let strategy: string | undefined

    if (this.whitelabelRepository) {
      try {
        const user = await this.userApiClient.getUser(userId)
        if (user?.whitelabel_id) {
          const behavior = await this.whitelabelRepository.getSuspensionBehavior(user.whitelabel_id)
          if (behavior) strategy = behavior
        }
      } catch {
        this.logger.warn('Failed to resolve suspension strategy from user whitelabel', { userId })
      }
    }

    // Fall back to event metadata if user lookup failed
    if (!strategy) {
      strategy = event.metadata?.suspensionStrategy as string | undefined
    }

    this.logger.info('Applying suspension strategy', { userId, strategy: strategy ?? 'DOWNGRADE_TO_FREE (default)' })

    await this.applyDowngrade(userId, strategy)

    // If this is a team plan, also suspend all team members
    await this.suspendTeamMembers(event, userId, strategy)
  }

  /**
   * Put one user where a lapse should leave them.
   *
   * `DEACTIVATE_USER` is `SHELL`, which is what the branch it replaces already did, whatever its
   * name claims. `SHELL` derives `is_premium = 0` on the main API's side, so the bit this used to
   * clear by hand falls out of naming the role.
   *
   * `DOWNGRADE_TO_FREE` is the careful one. It has never meant "make them a free agent": it clears
   * the premium bit and leaves the role alone, so a lapsing INVESTOR stays an investor. Translating
   * it as an unconditional `AGENT_FREE` would move every non-agent into the agent family on lapse.
   * So the role is named only for the AGENT family, and everyone else still just loses the bit.
   *
   * Plan §9.5 replaces the strategy enum with the white label's `downgrade_role_v2`, which is what
   * lets a lapsed eXp Pro land on `AGENT_EXP_GUEST` rather than a CashOffers account they never
   * signed up for. That column does not exist yet; this is its default when it does.
   */
  private async applyDowngrade(userId: number, strategy?: string): Promise<void> {
    if (strategy === 'DEACTIVATE_USER') {
      await this.userApiClient.updateUser(userId, { role_v2: 'SHELL' })
      return
    }

    const user = await this.userApiClient.getUser(userId)
    const downgradeTo = downgradeRoleV2For(resolveUserRoleV2(user))

    if (downgradeTo) {
      await this.userApiClient.updateUser(userId, { role_v2: downgradeTo })
    } else {
      await this.userApiClient.updateUser(userId, { is_premium: 0 })
    }
  }

  /**
   * When a team plan subscription is suspended, deactivate all team members
   * (excluding the owner, who was already handled above).
   */
  private async suspendTeamMembers(event: IDomainEvent, ownerId: number, strategy?: string): Promise<void> {
    if (!this.db || !this.subscriptionRepository) return

    const payload = event.payload as any
    const subscriptionId = payload.subscriptionId
    if (!subscriptionId) return

    const subscription = await this.subscriptionRepository.findById(subscriptionId)
    if (!subscription) return

    const subData = typeof subscription.data === 'string' ? JSON.parse(subscription.data) : subscription.data
    if (!subData?.cashoffers?.user_config?.is_team_plan || !subData.team_id) return

    const teamMembers = await this.db
      .selectFrom("Users")
      .select(["user_id"])
      .where("team_id", "=", subData.team_id)
      .where("active", "=", 1)
      .where("user_id", "!=", ownerId)
      .execute()

    if (teamMembers.length === 0) return

    this.logger.info('Suspending team members', {
      ownerId,
      teamId: subData.team_id,
      memberCount: teamMembers.length,
      strategy: strategy ?? 'DOWNGRADE_TO_FREE (default)',
    })

    for (const member of teamMembers) {
      try {
        await this.applyDowngrade(member.user_id, strategy)
      } catch (err) {
        this.logger.error('Failed to suspend team member', {
          userId: member.user_id,
          teamId: subData.team_id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  /**
   * When a team plan subscription is reactivated (resumed or renewed),
   * restore all team members. Owner role comes from product config (e.g. TEAMOWNER);
   * team members are set to AGENT with is_premium restored.
   *
   * **Deliberately still a legacy write, and the only one left in this file.** A member's own tier
   * is not what the team plan bought: the plan bought their seat. The main API's derivation guard
   * makes `role = AGENT` a no-op for a member who is separately an Express Offers Elite; naming
   * `role_v2` here would bypass that guard and flatten them to `AGENT_PREMIUM` on every renewal,
   * which is plan failure F2 with a new cause. Converting this needs the member's own role read
   * first, which is plan §9.5's `downgrade_role_v2` work, not this phase's.
   */
  private async reactivateTeamMembers(
    event: IDomainEvent,
    ownerId: number,
    userConfig: NonNullable<NonNullable<ProductData['cashoffers']>['user_config']>,
  ): Promise<void> {
    if (!userConfig.is_team_plan || !this.db || !this.subscriptionRepository) return

    const payload = event.payload as any
    const subscriptionId = payload.subscriptionId
    if (!subscriptionId) return

    const subscription = await this.subscriptionRepository.findById(subscriptionId)
    if (!subscription) return

    const subData = typeof subscription.data === 'string' ? JSON.parse(subscription.data) : subscription.data
    if (!subData?.team_id) return

    const teamMembers = await this.db
      .selectFrom("Users")
      .select(["user_id"])
      .where("team_id", "=", subData.team_id)
      .where("user_id", "!=", ownerId)
      .execute()

    if (teamMembers.length === 0) return

    this.logger.info('Reactivating team members', {
      ownerId,
      teamId: subData.team_id,
      memberCount: teamMembers.length,
    })

    for (const member of teamMembers) {
      try {
        await this.userApiClient.updateUser(member.user_id, {
          role: 'AGENT',
          is_premium: userConfig.is_premium,
        })
      } catch (err) {
        this.logger.error('Failed to reactivate team member', {
          userId: member.user_id,
          teamId: subData.team_id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  private async handleResumed(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const userConfig = productData.cashoffers.user_config
    if (!userConfig) return

    const payload = event.payload as any
    const userId = payload.userId

    const roleV2 = resolveUserConfigRoleV2(userConfig)
    if (roleV2) {
      await this.userApiClient.updateUser(userId, { role_v2: roleV2 })
    }

    // If team plan, reactivate all team members
    await this.reactivateTeamMembers(event, userId, userConfig)
  }

  private async handleUpgraded(event: IDomainEvent): Promise<void> {
    const payload = event.payload as any
    const userId = payload.userId
    const fromProductData = payload.fromProductData as ProductData | undefined
    const toProductData = payload.toProductData as ProductData | undefined

    if (!toProductData?.cashoffers?.managed) return

    const toUserConfig = toProductData.cashoffers.user_config
    if (!toUserConfig) return

    const fromIsTeamPlan = fromProductData?.cashoffers?.user_config?.is_team_plan ?? false
    const toIsTeamPlan = toUserConfig.is_team_plan ?? false

    // Converted with the three paths the plan names, though it is not one of them, because this is
    // the path a Pro becomes an Elite on. A change of plan between two products that are both
    // `AGENT` + `is_premium 1` is exactly the change the legacy pair cannot carry, and leaving it
    // here would have closed Q9 everywhere except the one place a customer actually triggers it.
    const baseRoleV2 = resolveUserConfigRoleV2(toUserConfig)
    if (!baseRoleV2) {
      this.logger.error('Upgrade target product names no resolvable role', undefined, {
        userId,
        newProductId: payload.newProductId,
        toUserConfig,
      })
      throw new Error('Upgrade target product names no resolvable role')
    }

    const roleV2 = mapRoleV2ForTransition({
      fromIsTeamPlan,
      toIsTeamPlan,
      baseRoleV2,
    })

    // Individual → Team: create a team and assign the user as owner
    if (!fromIsTeamPlan && toIsTeamPlan) {
      const whitelabelId = await this.resolveWhitelabelId(payload.newProductId)
      const user = await this.userApiClient.getUser(userId)
      const teamName = user?.name ? `${user.name}'s team` : `Team ${userId}`

      const team = await this.userApiClient.createTeam({
        teamname: teamName,
        owner_id: userId,
        max_users: toUserConfig.team_members ?? 6,
        whitelabel_id: whitelabelId,
      })

      await this.userApiClient.updateUser(userId, {
        team_id: team.id,
        role_v2: roleV2,
      })

      // Store team_id in subscription data so checkplan can find it
      if (this.subscriptionRepository && payload.subscriptionId) {
        try {
          const sub = await this.subscriptionRepository.findById(payload.subscriptionId)
          if (sub) {
            const subData = typeof sub.data === 'string' ? JSON.parse(sub.data) : (sub.data || {})
            subData.team_id = team.id
            await this.subscriptionRepository.update(payload.subscriptionId, {
              data: JSON.stringify(subData),
            })
          }
        } catch (err) {
          this.logger.warn("Failed to store team_id in subscription data", { subscriptionId: payload.subscriptionId, error: err })
        }
      }

      this.logger.info("Team created on plan upgrade", {
        userId,
        teamId: team.id,
        teamName,
        maxUsers: toUserConfig.team_members ?? 6,
      })
    } else {
      await this.userApiClient.updateUser(userId, {
        role_v2: roleV2,
      })
    }
  }
}
