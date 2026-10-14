/**
 * Desk #1350, PR #73 review findings 1 and 2. The key `trial` means two things: a PRODUCT's
 * `data.trial` is its trial SETTING (`{ enabled, duration_days, require_card }`), a SUBSCRIPTION's
 * `data.trial` is the trial MARKER (`{ ends_at, duration_days, reminder_sent_at? }`). Writers that
 * copy a product's data onto a subscription could store the setting under the marker's key.
 *
 * Finding 1 (D5): the carry kept the stored marker only when the new document had no `trial` at all,
 * so a plan change between two trial-enabled products replaced the marker with the setting.
 * Finding 2 (D1): "has a trial" was "data.trial is an object", which a setting passes, so a paying
 * subscriber holding a setting gained `ends_at` on the next write of renewal_date and read as a trial.
 *
 * The rules run inside MySQL, so each case evaluates the statement a real writer sends against the
 * stored row (`evaluateDataWrite`) and checks the document the row would hold. Staging proves the
 * same against real MySQL (PR #73, "Review fixes").
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { CompiledQuery } from "kysely"
import { capturingKysely, subscriptionUpdates } from "@api/tests/helpers/capturing-kysely"
import { evaluateCondition, evaluateDataWrite } from "@api/tests/helpers/evaluate-data-write"
import { SubscriptionRepository } from "@api/infrastructure/database/repositories/subscription.repository"
import { CashOffersWebhookHandler, addOneMonth } from "@api/application/webhook-handlers/cashoffers-webhook.handler"
import { ResumeSubscriptionUseCase } from "@api/use-cases/subscription/resume-subscription.use-case"
import { InMemoryEventBus } from "@api/infrastructure/events/in-memory-event-bus"
import { makeRecordingLogger } from "@api/tests/helpers/recording-logger"
import {
  readSubscriptionTrial,
  subscriptionDataFromProduct,
  trialDateDrift,
} from "@api/domain/services/subscription-trial"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-14T12:00:00.000Z")
const ENDS_AT = "2026-10-30T12:00:00.000Z"
const SETTING = { enabled: true, duration_days: 30, require_card: true }
const MARKER = { ends_at: ENDS_AT, duration_days: 30 }

/** InstantOffers365 Individual and Team (products 70 and 71), both with the trial switched on. */
const INDIVIDUAL_DATA = {
  duration: "monthly",
  renewal_cost: 25000,
  signup_fee: 0,
  trial: SETTING,
  cashoffers: { managed: true, user_config: { role: "AGENT", role_v2: "AGENT_PREMIUM", is_premium: 1 } },
}
const TEAM_DATA = {
  duration: "monthly",
  renewal_cost: 60000,
  signup_fee: 0,
  trial: SETTING,
  cashoffers: {
    managed: true,
    user_config: { role: "TEAMOWNER", is_premium: 1, is_team_plan: true, team_members: 6 },
  },
}

/** The marker test the drift candidates (`findUnconvertedTrials`) start their WHERE with. */
const STORED_MARKER_TEST = "COALESCE(JSON_TYPE(JSON_EXTRACT(Subscriptions.data, '$.trial.ends_at')) = 'STRING', FALSE)"

function row(data: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
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
    data: JSON.stringify(data),
    createdAt: new Date("2026-09-30T12:00:00.000Z"),
    updatedAt: new Date("2026-09-30T12:00:00.000Z"),
    ...overrides,
  }
}

function repositoryOver(state: () => Record<string, unknown>) {
  const { db, queries } = capturingKysely((q: CompiledQuery) =>
    q.sql.includes("from `Subscriptions`") ? [state()] : []
  )
  return { subscriptionRepository: new SubscriptionRepository(db), queries }
}

const renewalDateWritten = (update: CompiledQuery) => {
  const at = update.sql.indexOf("`renewal_date` = ?")
  if (at === -1) return undefined
  return update.parameters[(update.sql.slice(0, at).match(/\?/g) ?? []).length] as Date
}

/** Not a trial anywhere billing or the dashboard looks: no marker, no drift, not a drift candidate. */
function expectNoTrial(data: Record<string, unknown> | null, renewalDate: Date | undefined) {
  expect(readSubscriptionTrial(data)).toBeNull()
  expect((data?.trial as Record<string, unknown> | undefined)?.ends_at).toBeUndefined()
  expect(trialDateDrift({ data, renewal_date: renewalDate ?? null })).toBeNull()
  expect(evaluateCondition(STORED_MARKER_TEST, { data })).toBe(false)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe("(a) a trial agent changes between two trial-enabled products: the marker survives", () => {
  it("the plan change's document (product data with its setting stripped) gets the stored marker back", async () => {
    const stored = { ...INDIVIDUAL_DATA, trial: MARKER }
    const { subscriptionRepository, queries } = repositoryOver(() => row(stored))

    await subscriptionRepository.update(276, { product_id: 71, data: subscriptionDataFromProduct(TEAM_DATA) })

    const [update] = subscriptionUpdates(queries)
    const after = evaluateDataWrite(update, { data: JSON.stringify(stored) })!
    expect(after.trial).toEqual(MARKER)
    expect(after.cashoffers).toEqual(TEAM_DATA.cashoffers)
    expect(readSubscriptionTrial(after)!.ends_at).toBe(new Date(ENDS_AT).toISOString())
  })

  it("a document that still carries the product's setting (a writer that did not strip it) gets the marker, not the setting", async () => {
    const stored = { ...INDIVIDUAL_DATA, trial: MARKER }
    const { subscriptionRepository, queries } = repositoryOver(() => row(stored))

    await subscriptionRepository.update(276, { product_id: 71, data: JSON.stringify(TEAM_DATA) })

    const after = evaluateDataWrite(subscriptionUpdates(queries)[0], { data: JSON.stringify(stored) })!
    expect(after.trial).toEqual(MARKER)
    expect(after.trial).not.toHaveProperty("enabled")
  })

  it("with renewal_date written in the same statement, the carried marker's ends_at is the new renewal_date", async () => {
    const stored = { ...INDIVIDUAL_DATA, trial: MARKER }
    const { subscriptionRepository, queries } = repositoryOver(() => row(stored))
    const moved = new Date("2026-11-04T08:00:00.000Z")

    await subscriptionRepository.update(276, { data: JSON.stringify(TEAM_DATA), renewal_date: moved })

    const update = subscriptionUpdates(queries)[0]
    const after = evaluateDataWrite(update, { data: JSON.stringify(stored) })!
    expect(after.trial).toEqual({ ends_at: moved.toISOString(), duration_days: 30 })
    expect(renewalDateWritten(update)).toEqual(moved)
  })

  it("a converted trial's plan change takes the document as sent: the stored (historical) marker is not carried", async () => {
    const stored = { ...INDIVIDUAL_DATA, trial: MARKER }
    const { subscriptionRepository, queries } = repositoryOver(() => row(stored))

    await subscriptionRepository.update(276, { data: subscriptionDataFromProduct(TEAM_DATA) })

    const after = evaluateDataWrite(subscriptionUpdates(queries)[0], { data: JSON.stringify(stored), converted: true })
    expect(after).toEqual(JSON.parse(subscriptionDataFromProduct(TEAM_DATA)))
  })
})

describe("(b) a paying subscriber whose data came from a trial-enabled product never gains a marker", () => {
  /**
   * The two shapes such a row can hold: what the writers store now (the product's data without its
   * setting), and what a writer that copied product data wholesale stored before this fix (the
   * setting under `trial`). Neither is a trial.
   */
  const SHAPES: Array<[string, Record<string, unknown>]> = [
    ["the product's data as the writers store it now", JSON.parse(subscriptionDataFromProduct(INDIVIDUAL_DATA))],
    ["the product's data with its trial setting (a pre-fix wholesale copy)", INDIVIDUAL_DATA],
  ]

  for (const [label, stored] of SHAPES) {
    describe(label, () => {
      it("pause then reactivate through the CashOffers webhook: renewal_date moves, data stays as it was", async () => {
        let state = row(stored)
        const { subscriptionRepository, queries } = repositoryOver(() => state)
        const { logger } = makeRecordingLogger()
        const handler = new CashOffersWebhookHandler({
          logger,
          userApiClient: {} as any,
          subscriptionRepository: subscriptionRepository as any,
          eventBus: new InMemoryEventBus(logger),
        })

        await handler.handle({ type: "user.deactivated", userId: 999843 })
        state = row(stored, { status: "paused", suspension_date: NOW })
        vi.setSystemTime(new Date(NOW.getTime() + 20 * DAY))
        await handler.handle({ type: "user.activated", userId: 999843 })

        const reactivate = subscriptionUpdates(queries).find((q) => renewalDateWritten(q) !== undefined)!
        expect(renewalDateWritten(reactivate)).toEqual(addOneMonth(new Date(NOW.getTime() + 20 * DAY)))
        const after = evaluateDataWrite(reactivate, { data: JSON.stringify(stored) })
        expect(after).toEqual(stored)
        expectNoTrial(after, renewalDateWritten(reactivate))
      })

      it("resume: renewal_date shifts, data stays as it was", async () => {
        const { subscriptionRepository, queries } = repositoryOver(() =>
          row(stored, { status: "paused", suspension_date: new Date(NOW.getTime() - 10 * DAY) })
        )
        const { logger } = makeRecordingLogger()
        const useCase = new ResumeSubscriptionUseCase({
          logger,
          subscriptionRepository: subscriptionRepository as any,
          transactionRepository: { create: vi.fn(async (d: any) => ({ transaction_id: 1, ...d })) } as any,
        })

        expect((await useCase.execute({ subscriptionId: 276 })).success).toBe(true)

        const [resume] = subscriptionUpdates(queries)
        expect(renewalDateWritten(resume)).toBeInstanceOf(Date)
        const after = evaluateDataWrite(resume, { data: JSON.stringify(stored) })
        expect(after).toEqual(stored)
        expectNoTrial(after, renewalDateWritten(resume))
      })

      it("a plan change into another trial-enabled product: the new data holds no trial key and no marker", async () => {
        const { subscriptionRepository, queries } = repositoryOver(() => row(stored))

        await subscriptionRepository.update(276, { product_id: 71, data: subscriptionDataFromProduct(TEAM_DATA) })

        const after = evaluateDataWrite(subscriptionUpdates(queries)[0], { data: JSON.stringify(stored) })!
        expect(after).not.toHaveProperty("trial")
        expectNoTrial(after, new Date(ENDS_AT))
      })

      it("a plan change that also writes renewal_date adds no ends_at", async () => {
        const { subscriptionRepository, queries } = repositoryOver(() => row(stored))
        const moved = new Date("2026-11-20T00:00:00.000Z")

        await subscriptionRepository.update(276, { data: JSON.stringify(stored), renewal_date: moved })

        const after = evaluateDataWrite(subscriptionUpdates(queries)[0], { data: JSON.stringify(stored) })
        expect(after).toEqual(stored)
        expectNoTrial(after, moved)
      })
    })
  }
})

describe("the marker test itself", () => {
  it("a marker is a trial; a setting, a null ends_at, a non-object trial and no trial are not", () => {
    expect(evaluateCondition(STORED_MARKER_TEST, { data: JSON.stringify({ trial: MARKER }) })).toBe(true)
    expect(evaluateCondition(STORED_MARKER_TEST, { data: JSON.stringify({ trial: SETTING }) })).toBe(false)
    expect(evaluateCondition(STORED_MARKER_TEST, { data: JSON.stringify({ trial: { ends_at: null } }) })).toBe(false)
    expect(evaluateCondition(STORED_MARKER_TEST, { data: JSON.stringify({ trial: "yes" }) })).toBe(false)
    expect(evaluateCondition(STORED_MARKER_TEST, { data: JSON.stringify({ renewal_cost: 1 }) })).toBe(false)
    expect(evaluateCondition(STORED_MARKER_TEST, { data: null })).toBe(false)
  })

  it("findUnconvertedTrials (the drift candidates) starts its WHERE with exactly this test", async () => {
    const { subscriptionRepository, queries } = repositoryOver(() => row({}))
    await subscriptionRepository.findUnconvertedTrials()
    expect(queries[0].sql).toContain("where " + STORED_MARKER_TEST + " and ")
  })

  it("subscriptionDataFromProduct drops only the product's trial key", () => {
    expect(JSON.parse(subscriptionDataFromProduct(INDIVIDUAL_DATA))).toEqual({
      duration: "monthly",
      renewal_cost: 25000,
      signup_fee: 0,
      cashoffers: INDIVIDUAL_DATA.cashoffers,
    })
    expect(subscriptionDataFromProduct(JSON.stringify(TEAM_DATA))).not.toContain("trial")
    // A product with no trial, null and unparseable text are written as the writers wrote them before
    const plain = JSON.stringify({ duration: "monthly" })
    expect(subscriptionDataFromProduct(plain)).toBe(plain)
    expect(subscriptionDataFromProduct({ duration: "monthly" })).toBe(plain)
    expect(subscriptionDataFromProduct(null)).toBe("null")
    expect(subscriptionDataFromProduct("not json")).toBe("not json")
  })
})
