import type { IDomainEvent, IEventHandler } from "@api/infrastructure/events/event-bus.interface"
import type { IHomeUptickApiClient } from "@api/infrastructure/external-api/homeuptick-api/homeuptick-api.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductData } from "@api/domain/types/product-data.types"

/**
 * HomeUptickAccountHandler
 *
 * Listens to subscription lifecycle events and manages HomeUptick accounts
 * according to product configuration (homeuptick.enabled flag).
 *
 * When homeuptick.enabled = false → skip all HU API calls.
 */
export class HomeUptickAccountHandler implements IEventHandler {
  constructor(
    private readonly huApiClient: IHomeUptickApiClient,
    private readonly logger: ILogger
  ) {}

  async handle(event: IDomainEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'SubscriptionCreated':
          await this.handleCreated(event)
          break
        case 'SubscriptionRenewed':
          await this.handleRenewed(event)
          break
        case 'SubscriptionResumed':
          await this.handleResumed(event)
          break
        case 'SubscriptionUpgraded':
          await this.handleUpgraded(event)
          break
        case 'SubscriptionPaused':
        case 'SubscriptionDeactivated':
        case 'SubscriptionCancelled':
          await this.handleDeactivation(event)
          break
      }
    } catch (error) {
      this.logger.error(`HomeUptickAccountHandler error on ${event.eventType}`, {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
      })
      throw error
    }
  }

  private getProductData(event: IDomainEvent): ProductData | undefined {
    if (event.metadata?.productData) {
      return event.metadata.productData as ProductData
    }
    const payload = event.payload as any
    if (payload?.productData) {
      return payload.productData as ProductData
    }
    return undefined
  }

  private async handleCreated(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.homeuptick?.enabled) return

    const payload = event.payload as any
    const userId = payload.userId
    const huConfig = productData.homeuptick

    await this.huApiClient.createAccount(userId, huConfig)

    if (huConfig.free_trial?.enabled) {
      await this.huApiClient.setContactLimit(userId, huConfig.free_trial.contacts)
    }
  }

  private async handleRenewed(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.homeuptick?.enabled) return

    const payload = event.payload as any
    await this.huApiClient.activateAccount(payload.userId)
  }

  private async handleResumed(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.homeuptick?.enabled) return

    const payload = event.payload as any
    await this.huApiClient.activateAccount(payload.userId)
  }

  private async handleUpgraded(event: IDomainEvent): Promise<void> {
    const payload = event.payload as any
    const userId = payload.userId
    const toProductData = payload.toProductData as ProductData | undefined

    if (!toProductData?.homeuptick?.enabled) {
      // If the new product doesn't have HU enabled, deactivate the account
      const fromProductData = payload.fromProductData as ProductData | undefined
      if (fromProductData?.homeuptick?.enabled) {
        await this.huApiClient.deactivateAccount(userId)
      }
      return
    }

    // New product has HU enabled — activate and update contact limit if configured
    await this.huApiClient.activateAccount(userId)

    const huConfig = toProductData.homeuptick
    if (huConfig.base_contacts !== undefined) {
      await this.huApiClient.setContactLimit(userId, huConfig.base_contacts)
    }
  }

  private async handleDeactivation(event: IDomainEvent): Promise<void> {
    const productData = this.getProductData(event)
    if (!productData?.homeuptick?.enabled) return

    const payload = event.payload as any
    await this.huApiClient.deactivateAccount(payload.userId)
  }
}
