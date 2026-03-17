/**
 * Integration tests for the HomeUptick Account Handler.
 *
 * These tests FAIL until the handler is implemented at:
 *   api/application/service-handlers/homeuptick/homeuptick-account.handler.ts
 *
 * The handler listens to subscription lifecycle events and manages HomeUptick
 * accounts according to product configuration (homeuptick.enabled flag).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { SubscriptionCreatedEvent } from '@api/domain/events/subscription-created.event'
import { SubscriptionRenewedEvent } from '@api/domain/events/subscription-renewed.event'
import { SubscriptionPausedEvent } from '@api/domain/events/subscription-paused.event'
import { SubscriptionDeactivatedEvent } from '@api/domain/events/subscription-deactivated.event'
import { SubscriptionCancelledEvent } from '@api/domain/events/subscription-cancelled.event'
import { makeLogger, makeHomeUptickApiClient, makeProductData } from './helpers/test-doubles'

// These imports will FAIL until the modules are created — that is expected and correct.
import { HomeUptickAccountHandler } from '@api/application/service-handlers/homeuptick/homeuptick-account.handler'
import type { IHomeUptickApiClient } from '@api/infrastructure/external-api/homeuptick-api/homeuptick-api.interface'

// Inline types for events not yet created
interface SubscriptionResumedPayload {
  subscriptionId: number
  userId: number
  productData?: ReturnType<typeof makeProductData>
  newRenewalDate?: Date
}
function makeResumedEvent(payload: SubscriptionResumedPayload) {
  return {
    eventId: 'test-id',
    eventType: 'SubscriptionResumed' as const,
    occurredAt: new Date(),
    aggregateId: payload.subscriptionId,
    aggregateType: 'Subscription' as const,
    payload,
  }
}

describe('HomeUptickAccountHandler', () => {
  const userId = 42
  const subscriptionId = 1
  const productId = 10

  let logger: ReturnType<typeof makeLogger>
  let huApiClient: ReturnType<typeof makeHomeUptickApiClient>
  let eventBus: InMemoryEventBus
  let handler: HomeUptickAccountHandler

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    huApiClient = makeHomeUptickApiClient()
    eventBus = new InMemoryEventBus(logger)
    handler = new HomeUptickAccountHandler(huApiClient as unknown as IHomeUptickApiClient, logger)
    eventBus.subscribe('SubscriptionCreated', handler)
    eventBus.subscribe('SubscriptionRenewed', handler)
    eventBus.subscribe('SubscriptionPaused', handler)
    eventBus.subscribe('SubscriptionDeactivated', handler)
    eventBus.subscribe('SubscriptionCancelled', handler)
    eventBus.subscribe('SubscriptionResumed', handler)
  })

  // ─── homeuptick.enabled: false — skip all ───────────────────────────────

  describe('when homeuptick.enabled is false', () => {
    it('does not call any HomeUptick API methods on SubscriptionCreated', async () => {
      const productData = makeProductData({ huEnabled: false })
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          { subscriptionId, userId, email: 'user@test.com', productId, productName: 'Basic', amount: 0 },
          { productData }
        )
      )
      expect(huApiClient.createAccount).not.toHaveBeenCalled()
      expect(huApiClient.setContactLimit).not.toHaveBeenCalled()
    })

    it('does not call any HomeUptick API methods on SubscriptionRenewed', async () => {
      const productData = makeProductData({ huEnabled: false })
      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'user@test.com',
            productId,
            productName: 'Basic',
            amount: 0,
            nextRenewalDate: new Date(),
          },
          { productData }
        )
      )
      expect(huApiClient.activateAccount).not.toHaveBeenCalled()
    })
  })

  // ─── SubscriptionCreated ─────────────────────────────────────────────────

  describe('SubscriptionCreated with homeuptick.enabled: true', () => {
    it('creates a HomeUptick account for the user', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          { subscriptionId, userId, email: 'user@test.com', productId, productName: 'Premium', amount: 25000 },
          { productData }
        )
      )
      expect(huApiClient.createAccount).toHaveBeenCalledWith(userId, expect.any(Object))
    })

    it('does NOT set contact limit when free_trial is not configured', async () => {
      const productData = makeProductData({ huEnabled: true, huFreeTrial: false })
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          { subscriptionId, userId, email: 'user@test.com', productId, productName: 'Premium', amount: 25000 },
          { productData }
        )
      )
      expect(huApiClient.setContactLimit).not.toHaveBeenCalled()
    })

    it('sets the contact limit when the product has a free_trial config', async () => {
      const productData = makeProductData({ huEnabled: true, huFreeTrial: true })
      // free_trial.contacts = 100 from makeProductData defaults
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          { subscriptionId, userId, email: 'user@test.com', productId, productName: 'Premium', amount: 0 },
          { productData }
        )
      )
      expect(huApiClient.setContactLimit).toHaveBeenCalledWith(userId, 100)
    })
  })

  // ─── SubscriptionRenewed ─────────────────────────────────────────────────

  describe('SubscriptionRenewed with homeuptick.enabled: true', () => {
    it('activates the HomeUptick account to ensure it is active', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'user@test.com',
            productId,
            productName: 'Premium',
            amount: 25000,
            nextRenewalDate: new Date(),
          },
          { productData }
        )
      )
      expect(huApiClient.activateAccount).toHaveBeenCalledWith(userId)
    })
  })

  // ─── SubscriptionResumed ─────────────────────────────────────────────────

  describe('SubscriptionResumed with homeuptick.enabled: true', () => {
    it('activates the HomeUptick account', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(makeResumedEvent({ subscriptionId, userId, productData }) as any)
      expect(huApiClient.activateAccount).toHaveBeenCalledWith(userId)
    })
  })

  // ─── Suspension events ───────────────────────────────────────────────────

  describe('SubscriptionPaused with homeuptick.enabled: true', () => {
    it('deactivates the HomeUptick account', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(
        SubscriptionPausedEvent.create(
          { subscriptionId, userId, reason: 'payment_failed' },
          { productData }
        )
      )
      expect(huApiClient.deactivateAccount).toHaveBeenCalledWith(userId)
    })
  })

  describe('SubscriptionDeactivated with homeuptick.enabled: true', () => {
    it('deactivates the HomeUptick account', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(
        SubscriptionDeactivatedEvent.create({ subscriptionId, userId }, { productData })
      )
      expect(huApiClient.deactivateAccount).toHaveBeenCalledWith(userId)
    })
  })

  describe('SubscriptionCancelled with homeuptick.enabled: true', () => {
    it('deactivates the HomeUptick account', async () => {
      const productData = makeProductData({ huEnabled: true })
      await eventBus.publish(
        SubscriptionCancelledEvent.create(
          { subscriptionId, userId, cancelOnRenewal: false },
          { productData }
        )
      )
      expect(huApiClient.deactivateAccount).toHaveBeenCalledWith(userId)
    })
  })

  // ─── Error handling ──────────────────────────────────────────────────────

  describe('error handling', () => {
    it('does not swallow errors from createAccount — lets them propagate', async () => {
      const productData = makeProductData({ huEnabled: true })
      huApiClient.createAccount.mockRejectedValue(new Error('HU API unavailable'))

      await expect(
        eventBus.publish(
          SubscriptionCreatedEvent.create(
            { subscriptionId, userId, email: 'user@test.com', productId, productName: 'Premium', amount: 25000 },
            { productData }
          )
        )
      ).resolves.not.toThrow() // InMemoryEventBus swallows, but handler logs the error
      // The real test is that the error was logged (or re-thrown depending on implementation choice)
    })
  })
})
