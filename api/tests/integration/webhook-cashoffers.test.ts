/**
 * Integration tests for the CashOffers Webhook Handler.
 *
 * These tests FAIL until the handler is implemented at:
 *   api/application/webhook-handlers/cashoffers-webhook.handler.ts
 *
 * The handler (not an HTTP route) processes external webhook events from CashOffers:
 *   - user.deactivated → pause user's active subscription
 *   - user.activated   → resume user's suspended subscription (with renewal date adjustment)
 *   - user.created     (free user, no paid sub) → create free trial
 *
 * All event processing must be idempotent (safe to replay duplicate events).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import {
  makeLogger,
  makeUserApiClient,
  makeSubscriptionRepository,
  makeSubscriptionRow,
} from './helpers/test-doubles'

// This import will FAIL until the handler is created — that is expected and correct.
import { CashOffersWebhookHandler } from '@api/application/webhook-handlers/cashoffers-webhook.handler'

describe('CashOffersWebhookHandler', () => {
  const userId = 42
  const subscriptionId = 1

  let logger: ReturnType<typeof makeLogger>
  let userApiClient: ReturnType<typeof makeUserApiClient>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let eventBus: InMemoryEventBus
  let handler: CashOffersWebhookHandler

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    userApiClient = makeUserApiClient()
    subscriptionRepository = makeSubscriptionRepository()
    eventBus = new InMemoryEventBus(logger)

    handler = new CashOffersWebhookHandler({
      logger,
      userApiClient,
      subscriptionRepository: subscriptionRepository as any,
      eventBus,
    })
  })

  // ─── user.deactivated ────────────────────────────────────────────────────

  describe('user.deactivated webhook event', () => {
    it('pauses the user active subscription', async () => {
      subscriptionRepository.findActiveByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'active' }),
      ])

      await handler.handle({ type: 'user.deactivated', userId })

      // Should publish SubscriptionPausedEvent (or call PauseSubscriptionUseCase)
      const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
      const suspendCall = updateCalls.find((c) => c[1]?.status === 'suspended')
      expect(suspendCall).toBeDefined()
    })

    it('is idempotent: does nothing if user has no active subscription', async () => {
      subscriptionRepository.findActiveByUserId.mockResolvedValue([])

      await expect(handler.handle({ type: 'user.deactivated', userId })).resolves.not.toThrow()
      expect(subscriptionRepository.update).not.toHaveBeenCalled()
    })

    it('is idempotent: does nothing if subscription is already suspended', async () => {
      subscriptionRepository.findActiveByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'suspended' }),
      ])

      await handler.handle({ type: 'user.deactivated', userId })
      expect(subscriptionRepository.update).not.toHaveBeenCalled()
    })
  })

  // ─── user.activated ──────────────────────────────────────────────────────

  describe('user.activated webhook event', () => {
    it('resumes the user suspended subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'suspended',
          suspension_date: new Date('2026-03-01'),
          renewal_date: new Date('2026-03-15'),
        }),
      ])

      await handler.handle({ type: 'user.activated', userId })

      const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
      const resumeCall = updateCalls.find((c) => c[1]?.status === 'active')
      expect(resumeCall).toBeDefined()
    })

    it('adjusts the renewal date based on time paused', async () => {
      const suspensionDate = new Date('2026-03-01')
      const originalRenewalDate = new Date('2026-03-15') // 14 days remaining
      const resumeDate = new Date('2026-04-01') // paused for 31 days

      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'suspended',
          suspension_date: suspensionDate,
          renewal_date: originalRenewalDate,
        }),
      ])

      vi.setSystemTime(resumeDate)

      await handler.handle({ type: 'user.activated', userId })

      vi.useRealTimers()

      const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
      const resumeCall = updateCalls.find((c) => c[1]?.status === 'active')
      expect(resumeCall).toBeDefined()

      const newRenewalDate: Date = resumeCall[1].renewal_date
      // resume + 14 remaining days = Apr 15
      const expected = new Date('2026-04-15')
      expect(newRenewalDate.toDateString()).toBe(expected.toDateString())
    })

    it('is idempotent: does nothing if subscription is already active', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'active' }),
      ])

      await handler.handle({ type: 'user.activated', userId })
      expect(subscriptionRepository.update).not.toHaveBeenCalled()
    })

    it('is idempotent: does nothing if user has no subscriptions', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([])

      await expect(handler.handle({ type: 'user.activated', userId })).resolves.not.toThrow()
    })
  })

  // ─── user.created (free user, no paid subscription) ──────────────────────

  describe('user.created webhook event', () => {
    it('creates a free trial for a new free user', async () => {
      // No existing subscriptions
      subscriptionRepository.findByUserId.mockResolvedValue([])
      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'newuser@test.com',
        active: true,
        is_premium: false,
      })

      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await handler.handle({ type: 'user.created', userId })

      // A free trial subscription should be created and SubscriptionCreated event published
      expect(publishedEventTypes).toContain('SubscriptionCreated')
    })

    it('does NOT create a free trial if the user already has a paid subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'active', amount: 25000 }),
      ])

      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await handler.handle({ type: 'user.created', userId })

      expect(publishedEventTypes).not.toContain('SubscriptionCreated')
    })

    it('does NOT create a free trial if the user already has a trial subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'trial', amount: 0 }),
      ])

      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await handler.handle({ type: 'user.created', userId })

      expect(publishedEventTypes).not.toContain('SubscriptionCreated')
    })

    it('is idempotent: duplicate user.created events do not create a second trial', async () => {
      // First call: no subscriptions → creates trial
      subscriptionRepository.findByUserId
        .mockResolvedValueOnce([]) // first call: no subs
        .mockResolvedValue([
          makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'trial', amount: 0 }),
        ]) // subsequent calls: trial exists

      ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: userId,
        email: 'newuser@test.com',
        active: true,
        is_premium: false,
      })

      await handler.handle({ type: 'user.created', userId })
      await handler.handle({ type: 'user.created', userId }) // duplicate

      // create should have been called at most once
      const subscriptionCreateCalls = (subscriptionRepository.create as ReturnType<typeof vi.fn>).mock.calls
      expect(subscriptionCreateCalls.length).toBeLessThanOrEqual(1)
    })
  })
})
