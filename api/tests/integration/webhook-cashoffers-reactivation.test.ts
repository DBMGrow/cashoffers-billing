/**
 * Regression test — Zoho Desk ticket #1475
 * "YHS Agent signed back up but payment did not come out"
 *
 * Real-world symptom (prod user 967, agent "Sharad Gupta", whitelabel YHS):
 *   - Subscription 128 was suspended/cancelled (status='cancelled') on 2025-04-01.
 *   - Agent later "signed back up" and updated his card, but NO recurring charge
 *     came out in the following months.
 *
 * Root cause: when a user is reactivated, the main API emits a `user.activated`
 * webhook. CashOffersWebhookHandler.handleUserActivated originally only resumed
 * subscriptions whose status === 'paused'. A subscription left in 'cancelled' (or
 * 'suspended') state was never flipped back to 'active', so the renewal cron —
 * which selects only status='active' rows — never charged it. The agent showed
 * premium/active in the UI but was never billed.
 *
 * Fix: handleUserActivated now resumes the most recent paused/suspended/cancelled
 * subscription (guarding against an already-active sub and past renewal dates).
 * These tests lock in that behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import {
  makeLogger,
  makeUserApiClient,
  makeSubscriptionRepository,
  makeSubscriptionRow,
} from './helpers/test-doubles'
import { CashOffersWebhookHandler } from '@api/application/webhook-handlers/cashoffers-webhook.handler'

describe('CashOffersWebhookHandler — reactivation of a non-paused subscription (ticket #1475)', () => {
  const userId = 967
  const subscriptionId = 128

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

  it('resumes a CANCELLED subscription when the user is reactivated', async () => {
    // Exactly the prod state: subscription left 'cancelled' after suspension.
    subscriptionRepository.findByUserId.mockResolvedValue([
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'cancelled',
        suspension_date: new Date('2025-04-01'),
        renewal_date: new Date('2025-04-01'),
      }),
    ])

    await handler.handle({ type: 'user.activated', userId })

    // Desired: the cancelled subscription is flipped back to 'active' so the
    // renewal cron will charge it again. Today the handler ignores it.
    const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
    const resumeCall = updateCalls.find((c) => c[1]?.status === 'active')
    expect(resumeCall).toBeDefined()
  })

  it('resumes a SUSPENDED subscription when the user is reactivated', async () => {
    // The doc comment promises "resume user's suspended subscription", but the
    // code only matches 'paused'. A 'suspended' row is silently skipped too.
    subscriptionRepository.findByUserId.mockResolvedValue([
      makeSubscriptionRow({
        subscription_id: subscriptionId,
        user_id: userId,
        status: 'suspended',
        suspension_date: new Date('2025-04-01'),
        renewal_date: new Date('2025-04-01'),
      }),
    ])

    await handler.handle({ type: 'user.activated', userId })

    const updateCalls = (subscriptionRepository.update as ReturnType<typeof vi.fn>).mock.calls
    const resumeCall = updateCalls.find((c) => c[1]?.status === 'active')
    expect(resumeCall).toBeDefined()
  })
})
