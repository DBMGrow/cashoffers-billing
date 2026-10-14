/**
 * D1 (Desk #1350), AC20 and AC23: every billing writer of `Subscriptions.renewal_date` reaches the
 * database through `SubscriptionRepository.update`, which carries `data.trial.ends_at` along with it
 * until the trial converts. Each writer runs here against the real repository on a capturing
 * Kysely driver, and the test reads the statement it would send.
 *
 * The dev `set-state` route is covered in `api/routes/dev/set-state.trial-end.test.ts` (it needs
 * module mocks of its own).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { CompiledQuery } from "kysely"
import { capturingKysely, subscriptionUpdates, trialEndsAtWritten } from "@api/tests/helpers/capturing-kysely"
import { SubscriptionRepository } from "@api/infrastructure/database/repositories/subscription.repository"
import { CashOffersWebhookHandler, addOneMonth } from "@api/application/webhook-handlers/cashoffers-webhook.handler"
import { ResumeSubscriptionUseCase } from "@api/use-cases/subscription/resume-subscription.use-case"
import { RenewSubscriptionUseCase } from "@api/use-cases/subscription/renew-subscription.use-case"
import { InMemoryEventBus } from "@api/infrastructure/events/in-memory-event-bus"
import { MockPaymentProvider } from "@api/infrastructure/payment/mock/mock-payment.provider"
import { MockEmailService } from "@api/infrastructure/email/mock/mock-email.service"
import { makeRecordingLogger } from "@api/tests/helpers/recording-logger"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-14T12:00:00.000Z")
const ENDS_AT = "2026-10-30T12:00:00.000Z"

/** An unconverted 30-day card-on-file trial, as the purchase writes it. */
function trialRow(overrides: Record<string, unknown> = {}) {
  return {
    subscription_id: 276,
    user_id: 999843,
    subscription_name: "InstantOffers365 Individual",
    product_id: 70,
    amount: 25000,
    duration: "monthly",
    status: "active",
    renewal_date: new Date(ENDS_AT),
    next_renewal_attempt: null,
    payment_failure_count: 0,
    suspension_date: null,
    cancel_on_renewal: 0,
    downgrade_on_renewal: 0,
    square_environment: "sandbox",
    data: JSON.stringify({ trial: { ends_at: ENDS_AT, duration_days: 30 } }),
    createdAt: new Date("2026-09-30T12:00:00.000Z"),
    updatedAt: new Date("2026-09-30T12:00:00.000Z"),
    ...overrides,
  }
}

/** A real repository whose selects all answer with `row()`, the subscription's current state. */
function repositoryOver(row: () => Record<string, unknown>) {
  const { db, queries } = capturingKysely((q: CompiledQuery) => (q.sql.includes("from `Subscriptions`") ? [row()] : []))
  return { subscriptionRepository: new SubscriptionRepository(db), queries }
}

const renewalDateWritten = (update: CompiledQuery) => {
  // Parameters bind left to right: count the placeholders before renewal_date's own
  const at = update.sql.indexOf("`renewal_date` = ?")
  if (at === -1) return undefined
  const index = (update.sql.slice(0, at).match(/\?/g) ?? []).length
  return update.parameters[index] as Date
}

describe("AC20: each writer of renewal_date moves the trial end with it", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it("CashOffers webhook: pause (user.deactivated) leaves the dates, reactivate (user.activated) moves both", async () => {
    let state: Record<string, unknown> = trialRow()
    const { subscriptionRepository, queries } = repositoryOver(() => state)
    const { logger } = makeRecordingLogger()
    const handler = new CashOffersWebhookHandler({
      logger,
      userApiClient: {} as any,
      subscriptionRepository: subscriptionRepository as any,
      eventBus: new InMemoryEventBus(logger),
    })

    await handler.handle({ type: "user.deactivated", userId: 999843 })
    const [pause] = subscriptionUpdates(queries)
    expect(pause.sql).not.toContain("renewal_date")
    expect(trialEndsAtWritten(pause)).toBeNull()

    state = trialRow({ status: "paused", suspension_date: NOW })
    vi.setSystemTime(new Date(NOW.getTime() + 20 * DAY))
    await handler.handle({ type: "user.activated", userId: 999843 })

    const [, reactivate] = subscriptionUpdates(queries)
    const expected = addOneMonth(new Date(NOW.getTime() + 20 * DAY))
    expect(renewalDateWritten(reactivate)).toEqual(expected)
    expect(trialEndsAtWritten(reactivate)).toBe(expected.toISOString())
  })

  it("ResumeSubscriptionUseCase (the subscription resume route): the shifted renewal_date and ends_at move together", async () => {
    const suspendedAt = new Date(NOW.getTime() - 10 * DAY)
    const { subscriptionRepository, queries } = repositoryOver(() =>
      trialRow({ status: "paused", suspension_date: suspendedAt })
    )
    const { logger } = makeRecordingLogger()
    const useCase = new ResumeSubscriptionUseCase({
      logger,
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: { create: vi.fn(async (d: any) => ({ transaction_id: 1, ...d })) } as any,
    })

    const result = await useCase.execute({ subscriptionId: 276 })
    expect(result.success).toBe(true)

    const [resume] = subscriptionUpdates(queries)
    const written = renewalDateWritten(resume)!
    // 26 days were left when it was paused: the trial still has 26 days from the resume
    expect(Math.round((written.getTime() - NOW.getTime()) / DAY)).toBe(26)
    expect(trialEndsAtWritten(resume)).toBe(written.toISOString())
  })

  it("SubscriptionRepository.updateRenewalDate: moves ends_at to the date it is given", async () => {
    const { subscriptionRepository, queries } = repositoryOver(() => trialRow())
    const moved = new Date(new Date(ENDS_AT).getTime() + 5 * DAY)

    await subscriptionRepository.updateRenewalDate(276, moved)

    const [update] = subscriptionUpdates(queries)
    expect(renewalDateWritten(update)).toEqual(moved)
    expect(trialEndsAtWritten(update)).toBe(moved.toISOString())
  })
})

describe("AC23: the renewal that converts the trial does not carry ends_at forward", () => {
  afterEach(() => vi.useRealTimers())

  it("the renewal writes the next period while its RENEWAL request is CREATING_SUBSCRIPTION, which the rewrite treats as converting", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(ENDS_AT))

    const requests: any[] = []
    const purchaseRequestRepository = {
      findInFlightRenewal: async () => null,
      create: async (d: any) => {
        const r = { request_id: requests.length + 1, ...d }
        requests.push(r)
        return r
      },
      updateStatus: async (id: number, status: string) => Object.assign(requests[id - 1], { status }),
      markAsCompleted: async (id: number, results: any) =>
        Object.assign(requests[id - 1], { status: "COMPLETED", amount_charged: results.amountCharged }),
      markAsFailed: async (id: number) => Object.assign(requests[id - 1], { status: "FAILED" }),
    }

    // The request status at the moment each Subscriptions update is sent
    const statusAtUpdate: Array<{ query: CompiledQuery; status: string | undefined }> = []
    const { db, queries } = capturingKysely((q) => (q.sql.includes("from `Subscriptions`") ? [trialRow()] : []))
    const subscriptionRepository = new SubscriptionRepository(db)
    const update = subscriptionRepository.update.bind(subscriptionRepository)
    subscriptionRepository.update = (async (...args: Parameters<typeof update>) => {
      const result = await update(...args)
      statusAtUpdate.push({
        query: subscriptionUpdates(queries).slice(-1)[0],
        status: requests[requests.length - 1]?.status,
      })
      return result
    }) as typeof update

    const paymentProvider = new MockPaymentProvider()
    paymentProvider.addTestCard({
      id: "card_1",
      customerId: "cust_1",
      last4: "4242",
      cardBrand: "VISA",
      expMonth: 12,
      expYear: 2030,
    })
    const { logger } = makeRecordingLogger()
    const useCase = new RenewSubscriptionUseCase({
      logger,
      paymentProvider,
      emailService: new MockEmailService(),
      subscriptionRepository: subscriptionRepository as any,
      transactionRepository: { create: async (d: any) => ({ transaction_id: 1, ...d }) } as any,
      userCardRepository: {
        findByUserId: async () => [
          { id: 1, user_id: 999843, card_id: "card_1", square_customer_id: "cust_1", last_4: "4242" },
        ],
      } as any,
      purchaseRequestRepository: purchaseRequestRepository as any,
      config: { get: () => "", getOrThrow: () => "x", getAll: () => ({}) } as any,
      transactionManager: { runInTransaction: async (cb: any) => cb(undefined) },
      eventBus: new InMemoryEventBus(logger),
    })

    const result = await useCase.execute({ subscriptionId: 276, email: "trial@test.com" })
    expect(result.success).toBe(true)

    const renewal = statusAtUpdate.find(({ query }) => renewalDateWritten(query) !== undefined)!
    expect(renewalDateWritten(renewal.query)!.getTime()).toBeGreaterThan(new Date(ENDS_AT).getTime())
    expect(renewal.status).toBe("CREATING_SUBSCRIPTION")
    // ...and the statement carries the guard that skips the rewrite in that state
    expect(renewal.query.sql).toContain("OR trial_pr.status IN ('CREATING_SUBSCRIPTION', 'FINALIZING')")
    expect(requests[requests.length - 1]).toEqual(
      expect.objectContaining({ status: "COMPLETED", amount_charged: 25000 })
    )
  })
})
