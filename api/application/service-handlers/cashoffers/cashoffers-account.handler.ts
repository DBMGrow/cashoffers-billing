import type { IDomainEvent, IEventHandler } from "@api/infrastructure/events/event-bus.interface"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductRepository, WhitelabelRepository, SubscriptionRepository } from "@api/lib/repositories"
import type { ProductData } from "@api/domain/types/product-data.types"
import type { Kysely } from "kysely"
import type { DB } from "@api/lib/db.d"
import { mapRoleForTransition } from "@api/domain/services/role-mapper"

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
    try {
      switch (event.eventType) {
        case 'SubscriptionCreated':
          await this.handleCreated(event)
          break
        case 'SubscriptionRenewed':
          await this.handleRenewed(event)
          break
        case 'SubscriptionPaused':
        case 'SubscriptionDeactivated':
        case 'SubscriptionCancelled':
          await this.handleSuspension(event)
          break
        case 'SubscriptionResumed':
          await this.handleResumed(event)
          break
        case 'SubscriptionUpgraded':
          await this.handleUpgraded(event)
          break
      }
    } catch (error) {
      this.logger.error(`CashOffersAccountHandler error on ${event.eventType}`, {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
      })
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

    if (userWasCreated) {
      await this.userApiClient.createUser({
        email,
        is_premium: userConfig.is_premium,
        role: userConfig.role,
        whitelabel_id: whitelabelId,
      })
    } else {
      // Existing user: check if update needed
      const user = await this.userApiClient.getUser(userId)
      if (!user) return

      const needsUpdate =
        (user as any).is_premium !== (userConfig.is_premium === 1) ||
        (user as any).role !== userConfig.role ||
        (user as any).whitelabel_id !== whitelabelId

      if (needsUpdate) {
        await this.userApiClient.updateUser(userId, {
          is_premium: userConfig.is_premium === 1,
          role: userConfig.role,
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

    const needsUpdate =
      (user as any).is_premium !== (userConfig.is_premium === 1) ||
      (user as any).role !== userConfig.role

    if (needsUpdate) {
      await this.userApiClient.updateUser(userId, {
        role: userConfig.role,
        is_premium: userConfig.is_premium === 1,
      })
    }

    // If team plan, reactivate all team members on renewal
    await this.reactivateTeamMembers(event, userId, userConfig)
  }

  private async handleSuspension(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const payload = event.payload as any
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

    if (strategy === 'DEACTIVATE_USER') {
      await this.userApiClient.updateUser(userId, {
        role: 'SHELL',
        is_premium: false,
      })
    } else {
      // DOWNGRADE_TO_FREE or unresolved default
      await this.userApiClient.updateUser(userId, {
        is_premium: false,
      })
    }

    // If this is a team plan, also suspend all team members
    await this.suspendTeamMembers(event, userId, strategy)
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
        if (strategy === 'DEACTIVATE_USER') {
          await this.userApiClient.updateUser(member.user_id, {
            role: 'SHELL',
            is_premium: false,
          })
        } else {
          await this.userApiClient.updateUser(member.user_id, {
            is_premium: false,
          })
        }
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
          is_premium: userConfig.is_premium === 1,
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

    await this.userApiClient.updateUser(userId, {
      role: userConfig.role,
      is_premium: userConfig.is_premium === 1,
    })

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

    const role = mapRoleForTransition({
      fromIsTeamPlan,
      toIsTeamPlan,
      baseRole: toUserConfig.role,
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
        role,
        is_premium: toUserConfig.is_premium === 1,
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
        role,
        is_premium: toUserConfig.is_premium === 1,
      })
    }
  }
}
