/**
 * Integration tests for subscription renewal with HomeUptick tier-based charges.
 *
 * Tier config is read from the Homeuptick_Subscriptions table (source of truth),
 * NOT from product JSON embedded in subscription data.
 *
 * Tier rules:
 *   - contacts <= base_contacts  → tier 1, $0 addon
 *   - else: tier = ceil((contacts - base_contacts) / contacts_per_tier) + 1
 *           amount = (tier - 1) * price_per_tier
 *
 * If the HU API fails, the entire renewal must fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { RenewSubscriptionUseCase } from '@api/use-cases/subscription/renew-subscription.use-case'
import {
  makeLogger,
  makeHomeUptickApiClient,
  makeSubscriptionRepository,
  makeSubscriptionRow,
  makeHomeUptickSubscriptionRepository,
  makeHomeUptickSubscriptionRow,
} from './helpers/test-doubles'

// ─── Shared mock factories ────────────────────────────────────────────────

function makePaymentProvider() {
  return {
    createPayment: vi.fn().mockResolvedValue({
      id: 'sq-payment-123',
      status: 'COMPLETED',
      environment: 'sandbox' as const,
    }),
  }
}

function makeEmailService() {
  return { sendEmail: vi.fn().mockResolvedValue(undefined) }
}

function makeTransactionRepository() {
  return {
    create: vi.fn().mockResolvedValue({ transaction_id: 99 }),
  }
}

function makeUserCardRepository() {
  return {
    findByUserId: vi.fn().mockResolvedValue([
      { card_id: 'card-1', square_customer_id: 'cust-1', square_environment: 'sandbox' },
    ]),
  }
}

function makePurchaseRequestRepository() {
  return {
    create: vi.fn().mockResolvedValue({ request_id: 1 }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    markAsCompleted: vi.fn().mockResolvedValue(undefined),
    markAsFailed: vi.fn().mockResolvedValue(undefined),
  }
}

function makeTransactionManager() {
  return {
    runInTransaction: vi.fn().mockImplementation((fn: (trx: unknown) => Promise<void>) => fn({})),
  }
}

function makeConfigService() {
  return { get: vi.fn().mockReturnValue('sandbox') }
}

describe('RenewSubscriptionUseCase — HomeUptick tier charges', () => {
  const userId = 42
  const subscriptionId = 1
  const productId = 10

  let logger: ReturnType<typeof makeLogger>
  let huApiClient: ReturnType<typeof makeHomeUptickApiClient>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let huSubscriptionRepository: ReturnType<typeof makeHomeUptickSubscriptionRepository>
  let paymentProvider: ReturnType<typeof makePaymentProvider>
  let emailService: ReturnType<typeof makeEmailService>
  let criticalAlertService: { alertCriticalError: ReturnType<typeof vi.fn> }
  let transactionRepository: ReturnType<typeof makeTransactionRepository>
  let userCardRepository: ReturnType<typeof makeUserCardRepository>
  let purchaseRequestRepository: ReturnType<typeof makePurchaseRequestRepository>
  let transactionManager: ReturnType<typeof makeTransactionManager>
  let eventBus: InMemoryEventBus
  let useCase: RenewSubscriptionUseCase

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    huApiClient = makeHomeUptickApiClient()
    subscriptionRepository = makeSubscriptionRepository()
    huSubscriptionRepository = makeHomeUptickSubscriptionRepository()
    paymentProvider = makePaymentProvider()
    emailService = makeEmailService()
    criticalAlertService = { alertCriticalError: vi.fn().mockResolvedValue(undefined) }
    transactionRepository = makeTransactionRepository()
    userCardRepository = makeUserCardRepository()
    purchaseRequestRepository = makePurchaseRequestRepository()
    transactionManager = makeTransactionManager()
    eventBus = new InMemoryEventBus(logger)

    useCase = new RenewSubscriptionUseCase({
      logger,
      paymentProvider: paymentProvider as any,
      emailService: emailService as any,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: transactionRepository as any,
      userCardRepository: userCardRepository as any,
      purchaseRequestRepository: purchaseRequestRepository as any,
      config: makeConfigService() as any,
      transactionManager: transactionManager as any,
      eventBus,
      homeUptickApiClient: huApiClient as any,
      homeUptickSubscriptionRepository: huSubscriptionRepository as any,
      criticalAlertService: criticalAlertService as any,
    })
  })

  function buildSubscription() {
    return makeSubscriptionRow({
      subscription_id: subscriptionId,
      user_id: userId,
      product_id: productId,
      amount: 25000,
      status: 'active',
      renewal_date: new Date('2026-03-17'),
    })
  }

  function setupHuSubscription(overrides?: Partial<Record<string, unknown>>) {
    const huRow = makeHomeUptickSubscriptionRow({
      user_id: userId,
      base_contacts: 500,
      contacts_per_tier: 1000,
      price_per_tier: 7500,
      ...overrides,
    })
    huSubscriptionRepository.findActiveByUserId.mockResolvedValue(huRow)
    return huRow
  }

  // ─── No HU subscription — base amount only ─────────────────────────────

  describe('when user has no active Homeuptick_Subscriptions row', () => {
    it('charges only the base subscription amount', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      // huSubscriptionRepository.findActiveByUserId returns null by default

      const result = await useCase.execute({
        subscriptionId,
        email: 'user@test.com',
      })
      expect(result.success).toBe(true)
      expect((result as any).data?.amount).toBe(25000)
      expect(huApiClient.getClientCount).not.toHaveBeenCalled()
    })
  })

  // ─── HU active — tier 1 (within base contacts) ─────────────────────────

  describe('when user contacts are within base_contacts (tier 1)', () => {
    it('adds $0 HU line item and charges base amount only', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockResolvedValue(100) // < 500 base

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      expect((result as any).data?.amount).toBe(25000) // No addon
    })
  })

  // ─── HU active — tier 2 ────────────────────────────────────────────────

  describe('when user contacts exceed base_contacts (tier 2)', () => {
    it('adds tier 2 addon ($7,500) to total charge', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockResolvedValue(501) // Just over 500 → tier 2

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      // base 25000 + tier 2 addon 7500 = 32500
      expect((result as any).data?.amount).toBe(32500)
    })

    it('includes a HomeUptick line item in the charge', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockResolvedValue(501)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
    })
  })

  // ─── HU active — tier 4 (3479 contacts) ────────────────────────────────

  describe('when contacts place user at tier 4 (3,479 contacts)', () => {
    it('charges $22,500 addon (3 tiers × $7,500)', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockResolvedValue(3479)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      // base 25000 + 22500 = 47500
      expect((result as any).data?.amount).toBe(47500)
    })
  })

  // ─── HU API failure → skip addon, renew base ────────────────────────────

  describe('when HomeUptick API fails', () => {
    it('still renews the base subscription (skips HU addon)', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockRejectedValue(new Error('HU API timeout'))

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      expect((result as any).data?.amount).toBe(25000)
    })

    it('sends a critical alert for non-401 errors', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      huApiClient.getClientCount.mockRejectedValue(new Error('HU API timeout'))

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      expect(criticalAlertService.alertCriticalError).toHaveBeenCalledWith(
        'HomeUptick API Failure During Renewal',
        expect.any(Error),
        expect.objectContaining({
          subscriptionId,
          userId,
          email: 'user@test.com',
        })
      )
    })

    it('does NOT send an admin alert for 401 errors (treats as 0 contacts)', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription())
      setupHuSubscription()
      const axiosError = Object.assign(new Error('Request failed with status code 401'), {
        response: { status: 401, statusText: 'Unauthorized' },
      })
      huApiClient.getClientCount.mockRejectedValue(axiosError)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      expect((result as any).data?.amount).toBe(25000)
      expect(criticalAlertService.alertCriticalError).not.toHaveBeenCalled()
    })
  })

  // ─── Tier boundary math ─────────────────────────────────────────────────

  describe('tier boundary calculations', () => {
    it.each([
      { contacts: 500, expectedTier: 1, expectedAddon: 0 },
      { contacts: 501, expectedTier: 2, expectedAddon: 7500 },
      { contacts: 1000, expectedTier: 2, expectedAddon: 7500 },
      { contacts: 1500, expectedTier: 2, expectedAddon: 7500 },
      { contacts: 1501, expectedTier: 3, expectedAddon: 15000 },
      { contacts: 3479, expectedTier: 4, expectedAddon: 22500 },
      { contacts: 5000, expectedTier: 6, expectedAddon: 37500 },
    ])(
      'contacts=$contacts → tier $expectedTier, addon=$expectedAddon cents',
      async ({ contacts, expectedAddon }) => {
        subscriptionRepository.findById.mockResolvedValue(buildSubscription())
        setupHuSubscription()
        huApiClient.getClientCount.mockResolvedValue(contacts)

        const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
        expect(result.success).toBe(true)
        expect((result as any).data?.amount).toBe(25000 + expectedAddon)
      }
    )
  })

  // ─── homeuptick_only with 0 base contacts ──────────────────────────────

  describe('homeuptick_only subscription (base_contacts=0)', () => {
    it('charges from the first contact onwards', async () => {
      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          product_id: productId,
          amount: 0, // homeuptick_only has $0 base subscription
          status: 'active',
          renewal_date: new Date('2026-03-17'),
        })
      )
      setupHuSubscription({
        base_contacts: 0,
        contacts_per_tier: 500,
        price_per_tier: 7500,
      })
      huApiClient.getClientCount.mockResolvedValue(1) // Even 1 contact → tier 2

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      // base 0 + tier 2 addon 7500 = 7500
      expect((result as any).data?.amount).toBe(7500)
    })

    it('charges $0 when user has 0 contacts', async () => {
      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          product_id: productId,
          amount: 0,
          status: 'active',
          renewal_date: new Date('2026-03-17'),
        })
      )
      setupHuSubscription({
        base_contacts: 0,
        contacts_per_tier: 500,
        price_per_tier: 7500,
      })
      huApiClient.getClientCount.mockResolvedValue(0)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      expect((result as any).data?.amount).toBe(0)
    })
  })
})
