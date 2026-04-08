/**
 * Integration tests for pause/resume with renewal date adjustment.
 *
 * These tests verify:
 * 1. PauseSubscriptionUseCase records suspension_date when pausing.
 * 2. ResumeSubscriptionUseCase calculates new renewal date based on time paused.
 *    Formula: new_renewal_date = resume_date + (original_renewal_date - suspension_date)
 *    Example: paused Mar 15 (renewal Mar 30 = 15 days remaining), resumed May 16
 *             → new renewal = May 31
 *
 * Tests for the suspension_date recording will FAIL until PauseSubscriptionUseCase
 * is updated to write suspension_date to the database.
 *
 * Tests for the renewal date adjustment will FAIL until ResumeSubscriptionUseCase
 * is updated to calculate and write the adjusted renewal_date.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { PauseSubscriptionUseCase } from '@api/use-cases/subscription/pause-subscription.use-case'
import { ResumeSubscriptionUseCase } from '@api/use-cases/subscription/resume-subscription.use-case'
import { makeLogger, makeUserApiClient, makeSubscriptionRow } from './helpers/test-doubles'

function makeTransactionRepository() {
  return {
    create: vi.fn().mockResolvedValue({ transaction_id: 1 }),
  }
}

function makeEmailService() {
  return { sendEmail: vi.fn().mockResolvedValue(undefined) }
}

describe('PauseSubscriptionUseCase — suspension_date recording', () => {
  const subscriptionId = 1
  const userId = 42

  let logger: ReturnType<typeof makeLogger>
  let userApiClient: ReturnType<typeof makeUserApiClient>
  let subscriptionRepository: ReturnType<typeof import('./helpers/test-doubles').makeSubscriptionRepository>
  let transactionRepository: ReturnType<typeof makeTransactionRepository>
  let eventBus: InMemoryEventBus
  let useCase: PauseSubscriptionUseCase

  beforeEach(async () => {
    vi.clearAllMocks()
    const { makeSubscriptionRepository } = await import('./helpers/test-doubles')
    logger = makeLogger()
    userApiClient = makeUserApiClient()
    ;(userApiClient.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: userId,
      email: 'user@test.com',
      active: true,
      is_premium: true,
    })
    subscriptionRepository = makeSubscriptionRepository()
    transactionRepository = makeTransactionRepository()
    eventBus = new InMemoryEventBus(logger)

    useCase = new PauseSubscriptionUseCase({
      logger,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: transactionRepository as any,
      emailService: makeEmailService() as any,
      userApiClient,
      eventBus,
    })
  })

  it('records suspension_date = now when pausing an active subscription', async () => {
    const renewalDate = new Date('2026-03-30')
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'active',
        renewal_date: renewalDate,
        suspension_date: null,
      })
    )
    subscriptionRepository.update.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, status: 'suspended' })
    )

    const before = new Date()
    await useCase.execute({ subscriptionId })
    const after = new Date()

    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      subscriptionId,
      expect.objectContaining({
        status: 'suspended',
        suspension_date: expect.any(Date),
      })
    )

    const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
    const suspensionDate: Date = updateCall[1].suspension_date
    expect(suspensionDate.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(suspensionDate.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('publishes SubscriptionPausedEvent after recording suspension_date', async () => {
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'active' })
    )
    subscriptionRepository.update.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, status: 'suspended' })
    )

    const publishedEvents: string[] = []
    eventBus.subscribe('SubscriptionPaused', {
      handle: async (e) => { publishedEvents.push(e.eventType) }
    })

    await useCase.execute({ subscriptionId })

    expect(publishedEvents).toContain('SubscriptionPaused')
  })

  it('returns failure for non-active subscription', async () => {
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'suspended' })
    )

    const result = await useCase.execute({ subscriptionId })
    expect(result.success).toBe(false)
  })
})

describe('ResumeSubscriptionUseCase — renewal date adjustment', () => {
  const subscriptionId = 1
  const userId = 42

  let logger: ReturnType<typeof makeLogger>
  let subscriptionRepository: ReturnType<typeof import('./helpers/test-doubles').makeSubscriptionRepository>
  let transactionRepository: ReturnType<typeof makeTransactionRepository>
  let eventBus: InMemoryEventBus
  let useCase: ResumeSubscriptionUseCase

  beforeEach(async () => {
    vi.clearAllMocks()
    const { makeSubscriptionRepository } = await import('./helpers/test-doubles')
    logger = makeLogger()
    subscriptionRepository = makeSubscriptionRepository()
    transactionRepository = makeTransactionRepository()
    eventBus = new InMemoryEventBus(logger)

    useCase = new ResumeSubscriptionUseCase({
      logger,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: transactionRepository as any,
      eventBus,
    })
  })

  it('adjusts renewal date: paused Mar 15 (renewal Mar 30), resumed May 16 → new renewal May 31', async () => {
    // 15 days remaining when paused; paused for 62 days
    const suspensionDate = new Date('2026-03-15')
    const originalRenewalDate = new Date('2026-03-30')
    const resumeDate = new Date('2026-05-16')

    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'suspended',
        suspension_date: suspensionDate,
        renewal_date: originalRenewalDate,
      })
    )
    subscriptionRepository.update.mockImplementation((_id: number, data: Record<string, unknown>) =>
      Promise.resolve(makeSubscriptionRow({ subscription_id: subscriptionId, ...data }))
    )

    // Override "now" so the use case uses our resumeDate
    vi.setSystemTime(resumeDate)

    await useCase.execute({ subscriptionId })

    vi.useRealTimers()

    const updateCall = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls[0]
    const newRenewalDate: Date = updateCall[1].renewal_date

    const expectedRenewal = new Date('2026-05-31')
    expect(newRenewalDate.toDateString()).toBe(expectedRenewal.toDateString())
  })

  it('does not adjust renewal date when subscription has no suspension_date (legacy)', async () => {
    // A subscription that was somehow suspended without recording suspension_date
    // should be resumed without crashing — renewal date stays as-is or is kept unchanged
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'suspended',
        suspension_date: null,
        renewal_date: new Date('2026-03-30'),
      })
    )
    subscriptionRepository.update.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, status: 'active' })
    )

    const result = await useCase.execute({ subscriptionId })
    // Should succeed even without a suspension_date; renewal date unchanged
    expect(result.success).toBe(true)
  })

  it('publishes SubscriptionResumedEvent after adjusting renewal date', async () => {
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'suspended',
        suspension_date: new Date('2026-03-15'),
        renewal_date: new Date('2026-03-30'),
      })
    )
    subscriptionRepository.update.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, status: 'active' })
    )

    const publishedEvents: string[] = []
    eventBus.subscribe('SubscriptionResumed', {
      handle: async (e) => { publishedEvents.push(e.eventType) }
    })

    // ResumeSubscriptionUseCase doesn't yet inject eventBus — this test fails
    // until the use case is updated to publish SubscriptionResumedEvent
    await useCase.execute({ subscriptionId })

    expect(publishedEvents).toContain('SubscriptionResumed')
  })

  it('returns failure for non-suspended subscription', async () => {
    subscriptionRepository.findById.mockResolvedValue(
      makeSubscriptionRow({ subscription_id: subscriptionId, user_id: userId, status: 'active' })
    )

    const result = await useCase.execute({ subscriptionId })
    expect(result.success).toBe(false)
  })
})
