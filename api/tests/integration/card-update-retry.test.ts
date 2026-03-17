/**
 * Integration tests for card update → immediate renewal retry.
 *
 * When a CardUpdatedEvent fires:
 *   - If the user's subscription has next_renewal_attempt set → trigger immediate renewal
 *   - If the user's subscription has status="suspended" (auto-suspended after retries) → trigger renewal
 *   - Otherwise (healthy subscription) → do nothing
 *
 * These tests FAIL until a CardUpdatedHandler is implemented that listens to CardUpdated
 * events and triggers immediate renewal via RenewSubscriptionUseCase (or similar).
 *
 * The handler will live at one of:
 *   api/application/event-handlers/card-updated.handler.ts
 *   api/application/service-handlers/card-updated-retry.handler.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { CardUpdatedEvent } from '@api/domain/events/card-updated.event'
import {
  makeLogger,
  makeSubscriptionRepository,
  makeSubscriptionRow,
} from './helpers/test-doubles'

// This import will FAIL until the handler is created — that is expected and correct.
import { CardUpdatedRetryHandler } from '@api/application/event-handlers/card-updated-retry.handler'

function makeRenewSubscriptionUseCase() {
  return {
    execute: vi.fn().mockResolvedValue({ success: true, data: { subscriptionId: 1, amount: 25000 } }),
  }
}

function makeCardUpdatedEvent(userId: number, cardId = 'card-abc') {
  return CardUpdatedEvent.create({
    cardId,
    userId,
    email: 'user@test.com',
    cardLast4: '4242',
    cardBrand: 'Visa',
    externalCardId: 'sq-card-123',
    paymentProvider: 'Square',
    isDefault: true,
  })
}

describe('CardUpdatedRetryHandler', () => {
  const userId = 42
  const subscriptionId = 1

  let logger: ReturnType<typeof makeLogger>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let renewUseCase: ReturnType<typeof makeRenewSubscriptionUseCase>
  let eventBus: InMemoryEventBus
  let handler: CardUpdatedRetryHandler

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    subscriptionRepository = makeSubscriptionRepository()
    renewUseCase = makeRenewSubscriptionUseCase()
    eventBus = new InMemoryEventBus(logger)

    handler = new CardUpdatedRetryHandler({
      logger,
      subscriptionRepository: subscriptionRepository as any,
      renewSubscriptionUseCase: renewUseCase as any,
    })

    eventBus.subscribe('CardUpdated', handler)
  })

  // ─── Pending renewal attempt ─────────────────────────────────────────────

  describe('when user has a subscription with next_renewal_attempt set', () => {
    it('triggers an immediate renewal attempt', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: new Date('2026-03-18'), // pending retry
        }),
      ])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId, email: 'user@test.com' })
      )
    })

    it('triggers renewal for the correct subscription', async () => {
      const targetSubscriptionId = 7
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: targetSubscriptionId,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: new Date('2026-03-18'),
        }),
      ])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: targetSubscriptionId })
      )
    })
  })

  // ─── Auto-suspended subscription ─────────────────────────────────────────

  describe('when user has a subscription with status="suspended" due to payment failure', () => {
    it('triggers an immediate renewal attempt to reactivate the subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'suspended',
          next_renewal_attempt: null, // cleared after auto-suspension
        }),
      ])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId })
      )
    })
  })

  // ─── Healthy subscription — do nothing ──────────────────────────────────

  describe('when user has a healthy active subscription with no pending retry', () => {
    it('does NOT trigger a renewal attempt', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: null, // no pending retry
        }),
      ])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).not.toHaveBeenCalled()
    })
  })

  // ─── No subscriptions ────────────────────────────────────────────────────

  describe('when user has no subscriptions', () => {
    it('does NOT trigger any renewal attempt', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).not.toHaveBeenCalled()
    })
  })

  // ─── Multiple subscriptions ──────────────────────────────────────────────

  describe('when user has multiple subscriptions with pending retries', () => {
    it('triggers renewal for each subscription with a pending retry', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: 1,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: new Date('2026-03-18'),
        }),
        makeSubscriptionRow({
          subscription_id: 2,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: new Date('2026-03-19'),
        }),
        makeSubscriptionRow({
          subscription_id: 3,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: null, // healthy, skip
        }),
      ])

      await eventBus.publish(makeCardUpdatedEvent(userId))

      expect(renewUseCase.execute).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Renewal failure after card update ──────────────────────────────────

  describe('when the immediate renewal attempt fails after card update', () => {
    it('does not throw — gracefully handles renewal failure', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          next_renewal_attempt: new Date('2026-03-18'),
        }),
      ])
      renewUseCase.execute.mockResolvedValue({ success: false, error: 'Payment declined', code: 'RENEWAL_ERROR' })

      await expect(eventBus.publish(makeCardUpdatedEvent(userId))).resolves.not.toThrow()
    })
  })
})
