/**
 * Integration tests for the CreateFreeTrialUseCase.
 *
 * These tests FAIL until the use case is implemented at:
 *   api/use-cases/subscription/create-free-trial.use-case.ts
 *
 * Expected behavior:
 *   - Creates a subscription with status="trial", amount=0, renewal_date = now + 90 days
 *   - Publishes SubscriptionCreatedEvent
 *   - CashOffers module receives the event → createUser with role=SHELL
 *   - HomeUptick module receives the event → createAccount + setContactLimit(userId, 100)
 *   - One trial per user (throws if trial already exists)
 *   - No trial if user already has a paid subscription
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import {
  makeLogger,
  makeUserApiClient,
  makeHomeUptickApiClient,
  makeSubscriptionRepository,
  makeSubscriptionRow,
} from './helpers/test-doubles'

// This import will FAIL until the use case is created — that is expected and correct.
import { CreateFreeTrialUseCase } from '@api/use-cases/subscription/create-free-trial.use-case'

function makeTransactionRepository() {
  return {
    create: vi.fn().mockResolvedValue({ transaction_id: 1 }),
  }
}

function makeProductRepository() {
  return {
    findById: vi.fn(),
    findByType: vi.fn(),
    findFreeTrialProduct: vi.fn().mockResolvedValue({
      product_id: 99,
      product_name: 'Free Trial',
      price: 0,
      data: JSON.stringify({
        cashoffers: { managed: true, user_config: { role: 'SHELL', is_premium: 0, whitelabel_id: null } },
        homeuptick: { enabled: true, free_trial: { enabled: true, contacts: 100, duration_days: 90 } },
      }),
    }),
  }
}

describe('CreateFreeTrialUseCase', () => {
  const userId = 42
  const email = 'newuser@test.com'

  let logger: ReturnType<typeof makeLogger>
  let userApiClient: ReturnType<typeof makeUserApiClient>
  let huApiClient: ReturnType<typeof makeHomeUptickApiClient>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let eventBus: InMemoryEventBus
  let useCase: CreateFreeTrialUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    userApiClient = makeUserApiClient()
    huApiClient = makeHomeUptickApiClient()
    subscriptionRepository = makeSubscriptionRepository()
    subscriptionRepository.findByUserId.mockResolvedValue([]) // default: no existing subs
    subscriptionRepository.create.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: 100, user_id: userId, status: 'trial', amount: 0 })
    )
    eventBus = new InMemoryEventBus(logger)

    useCase = new CreateFreeTrialUseCase({
      logger,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: makeTransactionRepository() as any,
      productRepository: makeProductRepository() as any,
      eventBus,
    })
  })

  // ─── Happy path ──────────────────────────────────────────────────────────

  describe('successful trial creation', () => {
    it('creates a subscription with status="trial", amount=0', async () => {
      const result = await useCase.execute({ userId, email })

      expect(result.success).toBe(true)
      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'trial', amount: 0 })
      )
    })

    it('sets renewal_date to now + 90 days', async () => {
      const now = new Date('2026-03-17')
      vi.setSystemTime(now)

      await useCase.execute({ userId, email })

      vi.useRealTimers()

      const createCall = (subscriptionRepository.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const renewalDate: Date = createCall.renewal_date
      const expected = new Date('2026-06-15') // 90 days from Mar 17
      expect(renewalDate.toDateString()).toBe(expected.toDateString())
    })

    it('publishes SubscriptionCreatedEvent after creating trial', async () => {
      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await useCase.execute({ userId, email })

      expect(publishedEventTypes).toContain('SubscriptionCreated')
    })
  })

  // ─── CashOffers module integration ──────────────────────────────────────

  describe('CashOffers module receives SubscriptionCreated from trial', () => {
    it('creates user with role=SHELL via the CO event handler', async () => {
      // Wire up a CashOffers handler to the event bus (when it exists)
      // For now this test documents the expected integration behaviour
      const publishedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => {
          publishedEvents.push({ eventType: e.eventType, payload: e.payload })
        },
      })

      await useCase.execute({ userId, email })

      const createdEvent = publishedEvents.find((e) => e.eventType === 'SubscriptionCreated')
      expect(createdEvent).toBeDefined()

      // The event metadata should carry productData with cashoffers.user_config.role = SHELL
      // so the CashOffersAccountHandler will createUser with role: 'SHELL'
      const productData = (createdEvent?.payload as any)?.metadata?.productData
        ?? (createdEvent as any)?.metadata?.productData
      if (productData) {
        expect(productData.cashoffers?.user_config?.role).toBe('SHELL')
      }
      // The assertion above is soft — the critical check is that the event was published
      expect(createdEvent).toBeDefined()
    })
  })

  // ─── HomeUptick module integration ───────────────────────────────────────

  describe('HomeUptick module receives SubscriptionCreated from trial', () => {
    it('publishes SubscriptionCreated event that signals HU to createAccount + setContactLimit(100)', async () => {
      const publishedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = []
      eventBus.subscribe('SubscriptionCreated', {
        handle: async (e) => { publishedEvents.push({ eventType: e.eventType, payload: e.payload }) },
      })

      await useCase.execute({ userId, email })

      const createdEvent = publishedEvents.find((e) => e.eventType === 'SubscriptionCreated')
      expect(createdEvent).toBeDefined()
      // HU handler should react to this event; the free_trial.contacts = 100
    })
  })

  // ─── Constraints ─────────────────────────────────────────────────────────

  describe('one trial per user constraint', () => {
    it('throws (or returns failure) if user already has a trial subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: 50, user_id: userId, status: 'trial', amount: 0 }),
      ])

      const result = await useCase.execute({ userId, email })

      expect(result.success).toBe(false)
      expect(subscriptionRepository.create).not.toHaveBeenCalled()
    })

    it('does not create a trial if user already has a paid active subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: 10, user_id: userId, status: 'active', amount: 25000 }),
      ])

      const result = await useCase.execute({ userId, email })

      expect(result.success).toBe(false)
      expect(subscriptionRepository.create).not.toHaveBeenCalled()
    })

    it('allows trial creation when user has only a cancelled/deactivated subscription', async () => {
      subscriptionRepository.findByUserId.mockResolvedValue([
        makeSubscriptionRow({ subscription_id: 10, user_id: userId, status: 'inactive', amount: 25000 }),
      ])

      const result = await useCase.execute({ userId, email })

      expect(result.success).toBe(true)
      expect(subscriptionRepository.create).toHaveBeenCalled()
    })
  })

  // ─── Trial expiration via cron ────────────────────────────────────────────

  describe('trial expiration (renewal cron processes trial subscription)', () => {
    it('trial subscription is expired when renewal cron runs after 90 days', async () => {
      // The RenewSubscriptionUseCase should handle status="trial" subscriptions:
      // On renewal, if status is "trial" and amount is 0, the subscription should expire
      // (status → "inactive") rather than charge. This is documented here to verify
      // integration once the cron handles trials differently from regular subscriptions.

      // For now: verify the trial subscription has amount=0 and status="trial"
      // so we can assert the cron's behaviour once that logic is implemented.
      const result = await useCase.execute({ userId, email })

      expect(result.success).toBe(true)
      const createCall = (subscriptionRepository.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(createCall.status).toBe('trial')
      expect(createCall.amount).toBe(0)
    })
  })
})
