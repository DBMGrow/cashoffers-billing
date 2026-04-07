import type { IDomainEvent, IEventHandler } from "@api/infrastructure/events/event-bus.interface"
import type { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductRepository, WhitelabelRepository } from "@api/lib/repositories"
import type { ProductData } from "@api/domain/types/product-data.types"
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
          is_premium: userConfig.is_premium,
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
        is_premium: userConfig.is_premium,
      })
    }
  }

  private async handleSuspension(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.cashoffers?.managed) return

    const payload = event.payload as any
    const userId = payload.userId
    const strategy = event.metadata?.suspensionStrategy as string | undefined

    if (strategy === 'DEACTIVATE_USER') {
      await this.userApiClient.updateUser(userId, {
        role: 'SHELL',
        is_premium: 0,
      })
    } else if (strategy === 'DOWNGRADE_TO_FREE') {
      await this.userApiClient.updateUser(userId, {
        is_premium: 0,
      })
    } else {
      // Default: downgrade to free
      await this.userApiClient.updateUser(userId, {
        is_premium: 0,
      })
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
      is_premium: userConfig.is_premium,
    })
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

    await this.userApiClient.updateUser(userId, {
      role,
      is_premium: toUserConfig.is_premium,
    })
  }
}
