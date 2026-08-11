/**
 * Integration tests for subscription renewal retry escalation and auto-suspension.
 *
 * Escalation is driven by `payment_failure_count`, NOT by elapsed time since
 * `next_renewal_attempt` (see docs/business/rules/payment-retry-rules.md):
 *
 *   payment_failure_count 0 → next attempt in +1 day
 *   payment_failure_count 1 → next attempt in +3 days
 *   payment_failure_count 2 → next attempt in +7 days
 *   payment_failure_count 3 → SUSPEND, stop retrying, publish SubscriptionDeactivated
 *
 * These tests previously set up each scenario by back-dating
 * `next_renewal_attempt` alone, which was how attempts were inferred before
 * `payment_failure_count` existed. With the counter left at 0 every case took the
 * "1st failure" branch, so the 3-day, 7-day and suspension cases failed. Auto
 * suspension IS implemented; the header used to claim otherwise.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { RenewSubscriptionUseCase } from '@api/use-cases/subscription/renew-subscription.use-case'
import {
  makeLogger,
  makeSubscriptionRepository,
  makeSubscriptionRow,
} from './helpers/test-doubles'

function makePaymentProvider(status: 'COMPLETED' | 'FAILED' = 'FAILED') {
  return {
    createPayment: vi.fn().mockResolvedValue({
      id: 'sq-payment-123',
      status,
      environment: 'sandbox' as const,
    }),
  }
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

function makeEmailService() {
  return { sendEmail: vi.fn().mockResolvedValue(undefined) }
}

/** Number of days between two dates (approximate, integer). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

describe('RenewSubscriptionUseCase — retry escalation', () => {
  const subscriptionId = 1
  const userId = 42
  const today = new Date('2026-03-17')

  let logger: ReturnType<typeof makeLogger>
  let subscriptionRepository: ReturnType<typeof makeSubscriptionRepository>
  let eventBus: InMemoryEventBus
  let useCase: RenewSubscriptionUseCase

  function buildUseCase() {
    return new RenewSubscriptionUseCase({
      logger,
      paymentProvider: makePaymentProvider('FAILED') as any,
      emailService: makeEmailService() as any,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: makeTransactionRepository() as any,
      userCardRepository: makeUserCardRepository() as any,
      purchaseRequestRepository: makePurchaseRequestRepository() as any,
      config: makeConfigService() as any,
      transactionManager: makeTransactionManager() as any,
      eventBus,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(today)
    logger = makeLogger()
    subscriptionRepository = makeSubscriptionRepository()
    eventBus = new InMemoryEventBus(logger)
    useCase = buildUseCase()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('1st failure — next_renewal_attempt is null', () => {
    it('schedules next attempt for today + 1 day', async () => {
      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: null,
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      const nextAttempt: Date = updateCall[1].next_renewal_attempt
      expect(daysBetween(today, nextAttempt)).toBe(1)
    })
  })

  describe('2nd failure — payment_failure_count = 1', () => {
    it('schedules next attempt for today + 3 days', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 1) // ~1 day ago

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
          payment_failure_count: 1, // one failure already recorded
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      const nextAttempt: Date = updateCall[1].next_renewal_attempt
      expect(daysBetween(today, nextAttempt)).toBe(3)
    })
  })

  describe('3rd failure — payment_failure_count = 2', () => {
    it('schedules next attempt for today + 7 days', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 4) // ~4 days ago

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
          payment_failure_count: 2, // two failures already recorded
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      const nextAttempt: Date = updateCall[1].next_renewal_attempt
      expect(daysBetween(today, nextAttempt)).toBe(7)
    })
  })

  describe('4th failure — payment_failure_count = 3 (auto-suspension)', () => {
    it('suspends the subscription instead of scheduling another retry', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 11)

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
          payment_failure_count: 3, // retry budget exhausted → suspend
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      // After auto-suspension: status should be "suspended", next_renewal_attempt cleared
      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(updateCall[1]).toMatchObject({
        status: 'suspended',
        next_renewal_attempt: null,
      })
    })

    // Auto-suspension publishes SubscriptionDeactivated, not SubscriptionPaused.
    // That is deliberate: the deactivated event is what carries the white-label
    // suspension strategy (DEACTIVATE_USER → SHELL role, DOWNGRADE_TO_FREE →
    // is_premium 0). SubscriptionPaused is the user-initiated pause.
    it('publishes SubscriptionDeactivatedEvent when auto-suspending', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 11)

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
          payment_failure_count: 3, // retry budget exhausted → suspend
        })
      )

      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionDeactivated', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      expect(publishedEventTypes).toContain('SubscriptionDeactivated')
    })

    it('does NOT schedule a further next_renewal_attempt after suspension', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 11)

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
          payment_failure_count: 3, // retry budget exhausted → suspend
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
      const finalUpdate = updateCalls[updateCalls.length - 1][1]
      expect(finalUpdate.next_renewal_attempt).toBeNull()
    })
  })
})
