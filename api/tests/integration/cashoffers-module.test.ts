/**
 * Integration tests for the CashOffers Account Handler.
 *
 * These tests FAIL until the handler is implemented at:
 *   api/application/service-handlers/cashoffers/cashoffers-account.handler.ts
 *
 * The handler listens to subscription lifecycle events and updates users in the
 * CashOffers main API according to product configuration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { SubscriptionCreatedEvent } from '@api/domain/events/subscription-created.event'
import { SubscriptionRenewedEvent } from '@api/domain/events/subscription-renewed.event'
import { SubscriptionPausedEvent } from '@api/domain/events/subscription-paused.event'
import { SubscriptionDeactivatedEvent } from '@api/domain/events/subscription-deactivated.event'
import { SubscriptionCancelledEvent } from '@api/domain/events/subscription-cancelled.event'
import { makeLogger, makeUserApiClient, makeProductData } from './helpers/test-doubles'

// This import will FAIL until the handler is created — that is expected and correct.
import { CashOffersAccountHandler } from '@api/application/service-handlers/cashoffers/cashoffers-account.handler'

// Inline type for events that don't exist yet
interface SubscriptionResumedPayload {
  subscriptionId: number
  userId: number
  productData?: ReturnType<typeof makeProductData>
  newRenewalDate?: Date
}
interface SubscriptionResumedEvent {
  eventId: string
  eventType: 'SubscriptionResumed'
  occurredAt: Date
  aggregateId: number
  aggregateType: 'Subscription'
  payload: SubscriptionResumedPayload
}

interface SubscriptionUpgradedPayload {
  subscriptionId: number
  userId: number
  fromProductData?: ReturnType<typeof makeProductData>
  toProductData?: ReturnType<typeof makeProductData>
}
interface SubscriptionUpgradedEvent {
  eventId: string
  eventType: 'SubscriptionUpgraded'
  occurredAt: Date
  aggregateId: number
  aggregateType: 'Subscription'
  payload: SubscriptionUpgradedPayload
}

function makeResumedEvent(payload: SubscriptionResumedPayload): SubscriptionResumedEvent {
  return {
    eventId: 'test-id',
    eventType: 'SubscriptionResumed',
    occurredAt: new Date(),
    aggregateId: payload.subscriptionId,
    aggregateType: 'Subscription',
    payload,
  }
}

function makeUpgradedEvent(payload: SubscriptionUpgradedPayload): SubscriptionUpgradedEvent {
  return {
    eventId: 'test-id',
    eventType: 'SubscriptionUpgraded',
    occurredAt: new Date(),
    aggregateId: payload.subscriptionId,
    aggregateType: 'Subscription',
    payload,
  }
}

describe('CashOffersAccountHandler', () => {
  const userId = 42
  const subscriptionId = 1
  const productId = 10

  let logger: ReturnType<typeof makeLogger>
  let userApiClient: ReturnType<typeof makeUserApiClient>
  let eventBus: InMemoryEventBus
  let handler: CashOffersAccountHandler

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    userApiClient = makeUserApiClient()
    ;(userApiClient.createUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId })
    ;(userApiClient.updateUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId })
    eventBus = new InMemoryEventBus(logger)
    handler = new CashOffersAccountHandler(userApiClient, logger)
    eventBus.subscribe('SubscriptionCreated', handler)
    eventBus.subscribe('SubscriptionRenewed', handler)
    eventBus.subscribe('SubscriptionPaused', handler)
    eventBus.subscribe('SubscriptionDeactivated', handler)
    eventBus.subscribe('SubscriptionCancelled', handler)
    eventBus.subscribe('SubscriptionResumed', handler)
    eventBus.subscribe('SubscriptionUpgraded', handler)
  })

  // ─── cashoffers.managed: false — skip all ────────────────────────────────

  describe('when cashoffers.managed is false', () => {
    it('does not call any user API methods on SubscriptionCreated', async () => {
      const productData = makeProductData({ cashofffersManaged: false })
      await eventBus.publish(
        SubscriptionCreatedEvent.create({
          subscriptionId,
          userId,
          email: 'user@test.com',
          productId,
          productName: 'Basic',
          amount: 0,
          userWasCreated: true,
          // Handler must read product config from the event payload or look it up via product ID.
          // For the test we pass it via metadata so the handler can inspect it.
        }, { productData })
      )
      expect(userApiClient.createUser).not.toHaveBeenCalled()
      expect(userApiClient.updateUser).not.toHaveBeenCalled()
    })
  })

  // ─── SubscriptionCreated — new user ─────────────────────────────────────

  describe('SubscriptionCreated with userWasCreated: true', () => {
    it('calls createUser with role, is_premium, and whitelabel_id from product config', async () => {
      const productData = makeProductData({
        role: 'AGENT',
        is_premium: 1,
        whitelabel_id: 7,
      })
      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'newuser@test.com',
            productId,
            productName: 'Premium Monthly',
            amount: 25000,
            userWasCreated: true,
          },
          { productData }
        )
      )
      expect(userApiClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'AGENT',
          is_premium: 1,
          whitelabel_id: 7,
        })
      )
    })
  })

  // ─── SubscriptionCreated — existing user ────────────────────────────────

  describe('SubscriptionCreated with userWasCreated: false', () => {
    it('calls updateUser when existing user config differs from product config', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1, whitelabel_id: 7 })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'existing@test.com',
        is_premium: false,
        role: 'AGENT',
        whitelabel_id: null,
        active: true,
      })

      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'existing@test.com',
            productId,
            productName: 'Premium Monthly',
            amount: 25000,
            userWasCreated: false,
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ is_premium: 1, whitelabel_id: 7 })
      )
    })

    it('does not call updateUser when existing user config already matches product config', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1, whitelabel_id: 7 })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'existing@test.com',
        is_premium: true,
        role: 'AGENT',
        whitelabel_id: 7,
        active: true,
      })

      await eventBus.publish(
        SubscriptionCreatedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'existing@test.com',
            productId,
            productName: 'Premium Monthly',
            amount: 25000,
            userWasCreated: false,
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).not.toHaveBeenCalled()
    })
  })

  // ─── SubscriptionRenewed ─────────────────────────────────────────────────

  describe('SubscriptionRenewed', () => {
    it('calls updateUser to ensure correct role and is_premium', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1 })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'user@test.com',
        is_premium: false,
        role: 'SHELL',
        active: true,
      })

      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'user@test.com',
            productId,
            productName: 'Premium Monthly',
            amount: 25000,
            nextRenewalDate: new Date('2026-05-17'),
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: 'AGENT', is_premium: 1 })
      )
    })
  })

  // ─── SubscriptionResumed ─────────────────────────────────────────────────

  describe('SubscriptionResumed', () => {
    it('restores product-configured role and is_premium', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1 })
      await eventBus.publish(
        makeResumedEvent({ subscriptionId, userId, productData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: 'AGENT', is_premium: 1 })
      )
    })
  })

  // ─── Suspension events — whitelabel behavior ────────────────────────────

  describe('suspension behavior based on whitelabel config', () => {
    describe('DEACTIVATE_USER suspension strategy', () => {
      it('calls updateUser with role SHELL and is_premium 0 on SubscriptionPaused', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        // DEACTIVATE_USER is the expected strategy when whitelabel_id is set and configured accordingly
        await eventBus.publish(
          SubscriptionPausedEvent.create(
            { subscriptionId, userId, reason: 'payment_failed' },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ role: 'SHELL', is_premium: 0 })
        )
        expect(userApiClient.deactivateUser).not.toHaveBeenCalled()
      })

      it('calls updateUser with role SHELL and is_premium 0 on SubscriptionDeactivated', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        await eventBus.publish(
          SubscriptionDeactivatedEvent.create(
            { subscriptionId, userId },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ role: 'SHELL', is_premium: 0 })
        )
      })

      it('calls updateUser with role SHELL and is_premium 0 on SubscriptionCancelled', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        await eventBus.publish(
          SubscriptionCancelledEvent.create(
            { subscriptionId, userId, cancelOnRenewal: false },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ role: 'SHELL', is_premium: 0 })
        )
      })
    })

    describe('DOWNGRADE_TO_FREE suspension strategy', () => {
      it('calls updateUser with is_premium 0 but keeps existing role on SubscriptionPaused', async () => {
        const productData = makeProductData({ whitelabel_id: undefined })
        await eventBus.publish(
          SubscriptionPausedEvent.create(
            { subscriptionId, userId },
            { productData, suspensionStrategy: 'DOWNGRADE_TO_FREE' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ is_premium: 0 })
        )
        // Should NOT set role to SHELL
        const callArgs = (userApiClient.updateUser as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(callArgs[1]).not.toHaveProperty('role', 'SHELL')
      })
    })
  })

  // ─── SubscriptionUpgraded ────────────────────────────────────────────────

  describe('SubscriptionUpgraded', () => {
    it('updates user role via role-mapper for single → team upgrade', async () => {
      const fromProductData = makeProductData({ is_team_plan: false, role: 'AGENT' })
      const toProductData = makeProductData({ is_team_plan: true, role: 'AGENT' })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: 'TEAMOWNER' })
      )
    })

    it('updates user role to AGENT for team → single downgrade', async () => {
      const fromProductData = makeProductData({ is_team_plan: true, role: 'TEAMOWNER' })
      const toProductData = makeProductData({ is_team_plan: false, role: 'AGENT' })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: 'AGENT' })
      )
    })

    it('uses product base role when plan type does not change', async () => {
      const fromProductData = makeProductData({ is_team_plan: false, role: 'AGENT' })
      const toProductData = makeProductData({ is_team_plan: false, role: 'INVESTOR', is_premium: 1 })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ role: 'INVESTOR', is_premium: 1 })
      )
    })
  })
})
