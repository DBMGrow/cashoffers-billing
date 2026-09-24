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
import { makeLogger, makeUserApiClient, makeProductData, makeWhitelabelResolution } from './helpers/test-doubles'

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
    const { productRepository, whitelabelRepository } = makeWhitelabelResolution(7)
    handler = new CashOffersAccountHandler(
      userApiClient,
      logger,
      productRepository as never,
      whitelabelRepository as never
    )
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
    it('calls createUser with role_v2 and whitelabel_id from product config', async () => {
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
      // `role_v2` replaces the `role` + `is_premium` pair here (plan CO-I271 §9.4). The pair is
      // derived back from it inside the API client, so the wire body is unchanged for a product
      // that could be expressed either way, the difference only shows for the eXp tiers, which
      // the pair cannot express at all.
      expect(userApiClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          role_v2: 'AGENT_PREMIUM',
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
        expect.objectContaining({ role_v2: 'AGENT_PREMIUM', whitelabel_id: 7 })
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
    it('calls updateUser to ensure the product\'s role', async () => {
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
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, expect.objectContaining({ role_v2: 'AGENT_PREMIUM' }))
    })

    it('sees an Express Offers Pro moving to Elite, which the legacy pair could not', async () => {
      // The reason the comparison moved. Both sides of the old check read `AGENT` + premium, so
      // needsUpdate came out false and the subscriber stayed on the tier they had stopped paying
      // for. Nothing reported it, because from the legacy columns nothing had happened.
      const productData = makeProductData({ role: 'AGENT', is_premium: 1, role_v2: 'AGENT_EXP_ELITE' })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'pro@test.com',
        is_premium: true,
        role: 'AGENT',
        role_v2: 'AGENT_EXP_PRO',
        active: true,
      })

      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'pro@test.com',
            productId,
            productName: 'Express Offers Elite',
            amount: 29900,
            nextRenewalDate: new Date('2026-05-17'),
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'AGENT_EXP_ELITE' })
    })

    it('leaves an Elite alone when the product already matches, rather than rewriting the role', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1, role_v2: 'AGENT_EXP_ELITE' })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'elite@test.com',
        is_premium: true,
        role: 'AGENT',
        role_v2: 'AGENT_EXP_ELITE',
        active: true,
      })

      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'elite@test.com',
            productId,
            productName: 'Express Offers Elite',
            amount: 29900,
            nextRenewalDate: new Date('2026-05-17'),
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).not.toHaveBeenCalled()
    })

    it('still renews a product that carries only the legacy pair', async () => {
      // The fallback that lets the two repos deploy independently (plan §9.4 "Order"). Deleted by
      // Phase 9 U91, until then a product that has not been backfilled must renew normally.
      const productData = makeProductData({ role: 'AGENT', is_premium: 1 })
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'legacy@test.com',
        is_premium: false,
        role: 'SHELL',
        active: true,
      })

      await eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId,
            userId,
            email: 'legacy@test.com',
            productId,
            productName: 'Premium Monthly',
            amount: 25000,
            nextRenewalDate: new Date('2026-05-17'),
          },
          { productData }
        )
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'AGENT_PREMIUM' })
    })
  })

  // ─── SubscriptionResumed ─────────────────────────────────────────────────

  describe('SubscriptionResumed', () => {
    it('restores the product-configured role', async () => {
      const productData = makeProductData({ role: 'AGENT', is_premium: 1 })
      await eventBus.publish(
        makeResumedEvent({ subscriptionId, userId, productData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, expect.objectContaining({ role_v2: 'AGENT_PREMIUM' }))
    })
  })

  // ─── Suspension events — whitelabel behavior ────────────────────────────

  describe('suspension behavior based on whitelabel config', () => {
    describe('DEACTIVATE_USER suspension strategy', () => {
      it('shells the user on SubscriptionPaused', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        // DEACTIVATE_USER is the expected strategy when whitelabel_id is set and configured accordingly
        await eventBus.publish(
          SubscriptionPausedEvent.create(
            { subscriptionId, userId, reason: 'payment_failed' },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        // `SHELL` alone, not `SHELL` + `is_premium: 0`. The main API derives the bit from the role
        // in the same statement, so the pair cannot be observed disagreeing and the second field
        // was only ever a second way of saying the first.
        expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'SHELL' })
        expect(userApiClient.deactivateUser).not.toHaveBeenCalled()
      })

      it('shells the user on SubscriptionDeactivated', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        await eventBus.publish(
          SubscriptionDeactivatedEvent.create(
            { subscriptionId, userId },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'SHELL' })
      })

      it('shells the user on SubscriptionCancelled', async () => {
        const productData = makeProductData({ whitelabel_id: 5 })
        await eventBus.publish(
          SubscriptionCancelledEvent.create(
            { subscriptionId, userId, cancelOnRenewal: false },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'SHELL' })
      })

      it('does NOT suspend on SubscriptionCancelled when cancelOnRenewal is true (#1542)', async () => {
        // Regression for #1542: a scheduled cancel emits SubscriptionCancelled with
        // cancelOnRenewal: true at schedule time; suspension must defer to the renewal
        // cron's re-emit (cancelOnRenewal: false), not fire now.
        const productData = makeProductData({ whitelabel_id: 5 })
        await eventBus.publish(
          SubscriptionCancelledEvent.create(
            { subscriptionId, userId, cancelOnRenewal: true },
            { productData, suspensionStrategy: 'DEACTIVATE_USER' }
          )
        )
        // Subscription stays active until the period ends — no role/premium change yet.
        expect(userApiClient.updateUser).not.toHaveBeenCalled()
        expect(userApiClient.deactivateUser).not.toHaveBeenCalled()
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
        expect(callArgs[1]).not.toHaveProperty('role_v2', 'SHELL')
      })

      it('names AGENT_FREE for an agent, so the tier is the thing that changes', async () => {
        ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: userId,
          email: 'agent@test.com',
          is_premium: true,
          role: 'AGENT',
          role_v2: 'AGENT_PREMIUM',
          active: true,
        })
        const productData = makeProductData({ whitelabel_id: undefined })
        await eventBus.publish(
          SubscriptionPausedEvent.create({ subscriptionId, userId }, { productData, suspensionStrategy: 'DOWNGRADE_TO_FREE' })
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'AGENT_FREE' })
      })

      it('leaves a lapsing investor an investor, and only clears the bit', async () => {
        // DOWNGRADE_TO_FREE has never meant "make them a free agent". Reading it that way would
        // move every lapsing investor, lender and team owner into the agent family, a change
        // nobody asked for, arriving silently, on the one path nobody watches succeed.
        ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: userId,
          email: 'investor@test.com',
          is_premium: true,
          role: 'INVESTOR',
          role_v2: 'INVESTOR',
          active: true,
        })
        const productData = makeProductData({ whitelabel_id: undefined })
        await eventBus.publish(
          SubscriptionPausedEvent.create({ subscriptionId, userId }, { productData, suspensionStrategy: 'DOWNGRADE_TO_FREE' })
        )
        expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { is_premium: 0 })
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
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, expect.objectContaining({ role_v2: 'TEAMOWNER' }))
    })

    it('lands a team → single downgrade on the new product\'s tier, not on bare AGENT', async () => {
      // The legacy mapper returned the literal `AGENT` here and let `is_premium` carry the tier.
      // `AGENT` is a legal role but not an assignable one, it is what a user is before anyone has
      // said which tier they are on, so the answer is the tier the product they moved onto sells.
      const fromProductData = makeProductData({ is_team_plan: true, role: 'TEAMOWNER' })
      const toProductData = makeProductData({ is_team_plan: false, role: 'AGENT', is_premium: 1 })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, expect.objectContaining({ role_v2: 'AGENT_PREMIUM' }))
    })

    it('carries a Pro to Elite plan change, which is where a customer actually triggers one', async () => {
      const fromProductData = makeProductData({ is_team_plan: false, role: 'AGENT', is_premium: 1, role_v2: 'AGENT_EXP_PRO' })
      const toProductData = makeProductData({ is_team_plan: false, role: 'AGENT', is_premium: 1, role_v2: 'AGENT_EXP_ELITE' })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, { role_v2: 'AGENT_EXP_ELITE' })
    })

    it('uses product base role when plan type does not change', async () => {
      const fromProductData = makeProductData({ is_team_plan: false, role: 'AGENT' })
      const toProductData = makeProductData({ is_team_plan: false, role: 'INVESTOR', is_premium: 1 })

      await eventBus.publish(
        makeUpgradedEvent({ subscriptionId, userId, fromProductData, toProductData }) as any
      )
      expect(userApiClient.updateUser).toHaveBeenCalledWith(userId, expect.objectContaining({ role_v2: 'INVESTOR' }))
    })
  })
})
