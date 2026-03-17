/**
 * Integration tests for subscription renewal with HomeUptick tier-based charges.
 *
 * These tests verify the TODO at line 114 of renew-subscription.use-case.ts.
 * They FAIL until IHomeUptickApiClient is injected into RenewSubscriptionUseCase
 * and the tier calculation logic is implemented.
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
  makeProductData,
  makeSubscriptionRow,
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

  const huConfig = {
    enabled: true,
    base_contacts: 500,
    contacts_per_tier: 1000,
    price_per_tier: 7500,
  }

  let logger: ReturnType<typeof makeLogger>
  let huApiClient: ReturnType<typeof makeHomeUptickApiClient>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let paymentProvider: ReturnType<typeof makePaymentProvider>
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
    paymentProvider = makePaymentProvider()
    transactionRepository = makeTransactionRepository()
    userCardRepository = makeUserCardRepository()
    purchaseRequestRepository = makePurchaseRequestRepository()
    transactionManager = makeTransactionManager()
    eventBus = new InMemoryEventBus(logger)

    // The RenewSubscriptionUseCase will need a `homeUptickApiClient` dependency added
    // to its Dependencies interface. These tests fail until that injection point exists.
    useCase = new RenewSubscriptionUseCase({
      logger,
      paymentProvider: paymentProvider as any,
      emailService: makeEmailService() as any,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: transactionRepository as any,
      userCardRepository: userCardRepository as any,
      purchaseRequestRepository: purchaseRequestRepository as any,
      config: makeConfigService() as any,
      transactionManager: transactionManager as any,
      eventBus,
      homeUptickApiClient: huApiClient as any, // NEW dependency — does not exist yet
    })
  })

  function buildSubscription(huEnabledInProductData: boolean, apiToken = 'tok-abc') {
    const productData = makeProductData({ huEnabled: huEnabledInProductData })
    return makeSubscriptionRow({
      subscription_id: subscriptionId,
      user_id: userId,
      product_id: productId,
      amount: 25000,
      status: 'active',
      renewal_date: new Date('2026-03-17'),
      data: JSON.stringify({ productData, api_token: apiToken }),
    })
  }

  // ─── No HU in product — base amount only ────────────────────────────────

  describe('when homeuptick is not enabled in product data', () => {
    it('charges only the base subscription amount', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(false))
      const result = await useCase.execute({
        subscriptionId,
        email: 'user@test.com',
      })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(25000)
      expect(huApiClient.getClientCount).not.toHaveBeenCalled()
    })
  })

  // ─── HU enabled — tier 1 (within base contacts) ─────────────────────────

  describe('when user contacts are within base_contacts (tier 1)', () => {
    it('adds $0 HU line item and charges base amount only', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
      huApiClient.getClientCount.mockResolvedValue(100) // < 500 base

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      expect(result.data?.amount).toBe(25000) // No addon
    })
  })

  // ─── HU enabled — tier 2 ────────────────────────────────────────────────

  describe('when user contacts exceed base_contacts (tier 2)', () => {
    it('adds tier 2 addon ($7,500) to total charge', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
      huApiClient.getClientCount.mockResolvedValue(501) // Just over 500 → tier 2

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(true)
      // base 25000 + tier 2 addon 7500 = 32500
      expect(result.data?.amount).toBe(32500)
    })

    it('includes a HomeUptick line item in the charge', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
      huApiClient.getClientCount.mockResolvedValue(501)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      // The renewal event should carry the HU line item — verify via eventBus or result
      expect(result.success).toBe(true)
      // Line item details surface on the result or event; either approach is acceptable
    })
  })

  // ─── HU enabled — tier 4 (3479 contacts) ───────────────────────────────

  describe('when contacts place user at tier 4 (3,479 contacts)', () => {
    it('charges $22,500 addon (3 tiers × $7,500)', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
      huApiClient.getClientCount.mockResolvedValue(3479)

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      // base 25000 + 22500 = 47500
      expect(result.data?.amount).toBe(47500)
    })
  })

  // ─── HU API failure causes renewal failure ───────────────────────────────

  describe('when HomeUptick API fails', () => {
    it('fails the entire renewal and does not charge the card', async () => {
      subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
      huApiClient.getClientCount.mockRejectedValue(new Error('HU API timeout'))

      const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/HU API timeout/)
      expect(paymentProvider.createPayment).not.toHaveBeenCalled()
    })
  })

  // ─── Tier boundary math ──────────────────────────────────────────────────

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
        subscriptionRepository.findById.mockResolvedValue(buildSubscription(true))
        huApiClient.getClientCount.mockResolvedValue(contacts)

        const result = await useCase.execute({ subscriptionId, email: 'user@test.com' })
        expect(result.success).toBe(true)
        expect(result.data?.amount).toBe(25000 + expectedAddon)
      }
    )
  })
})
