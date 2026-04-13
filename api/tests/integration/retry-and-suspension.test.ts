/**
 * Integration tests for subscription renewal retry escalation and auto-suspension.
 *
 * Current retry schedule:
 *   1st failure  → next attempt in +1 day
 *   2nd failure  → next attempt in +3 days (waited ~1 day)
 *   3rd failure  → next attempt in +7 days (waited ~4 days)
 *   4th failure  → SUSPEND subscription, stop retrying  ← NOT YET IMPLEMENTED
 *
 * The auto-suspension test (4th failure → suspend) FAILS because
 * RenewSubscriptionUseCase.handleRenewalFailure does not yet set
 * status = "suspended" or publish SubscriptionPausedEvent after the 4th attempt.
 *
 * All other retry tests pass against the current implementation.
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

  describe('2nd failure — last attempt was ~1 day ago', () => {
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
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      const nextAttempt: Date = updateCall[1].next_renewal_attempt
      expect(daysBetween(today, nextAttempt)).toBe(3)
    })
  })

  describe('3rd failure — last attempt was ~4 days ago', () => {
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
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
      const nextAttempt: Date = updateCall[1].next_renewal_attempt
      expect(daysBetween(today, nextAttempt)).toBe(7)
    })
  })

  describe('4th failure — last attempt was ~11 days ago (auto-suspension)', () => {
    it('suspends the subscription instead of scheduling another retry', async () => {
      // ~11 days since last attempt (1d + 3d + 7d = 11d total elapsed)
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 11)

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
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

    it('publishes SubscriptionPausedEvent when auto-suspending', async () => {
      const lastAttempt = new Date(today)
      lastAttempt.setDate(today.getDate() - 11)

      subscriptionRepository.findById.mockResolvedValue(
        makeSubscriptionRow({
          subscription_id: subscriptionId,
          user_id: userId,
          status: 'active',
          amount: 25000,
          next_renewal_attempt: lastAttempt,
        })
      )

      const publishedEventTypes: string[] = []
      eventBus.subscribe('SubscriptionPaused', {
        handle: async (e) => { publishedEventTypes.push(e.eventType) }
      })

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      expect(publishedEventTypes).toContain('SubscriptionPaused')
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
        })
      )

      await useCase.execute({ subscriptionId, email: 'user@test.com' })

      const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
      const finalUpdate = updateCalls[updateCalls.length - 1][1]
      expect(finalUpdate.next_renewal_attempt).toBeNull()
    })
  })
})
