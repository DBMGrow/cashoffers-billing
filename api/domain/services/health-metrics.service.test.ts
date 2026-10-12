import { describe, it, expect } from "vitest"
import { HealthMetricsService } from "./health-metrics.service"

// Minimal repository stubs — the metrics we test touch
// transactionRepository.findByDateRange and subscriptionRepository.findAll.
const makeService = (subscriptions: any[], transactions: any[] = []) => {
  const transactionRepository = { findByDateRange: async () => transactions }
  const subscriptionRepository = {
    findAll: async () => subscriptions,
    findActiveTrials: async () => [],
    findTrialsWithoutCard: async () => [],
    findEndedTrialsUnreconciled: async () => [],
  }
  const billingLogRepository = { findByDateRange: async () => [] }
  return new HealthMetricsService(
    transactionRepository as any,
    subscriptionRepository as any,
    billingLogRepository as any
  )
}

describe("HealthMetricsService.pastDueSubscriptions", () => {
  it("only counts active, user-bound subscriptions whose renewal_date is in the past as of now", async () => {
    // Report is generated for "today", so endDate is end-of-day (23:59:59).
    const today = new Date()
    const endOfToday = new Date(today)
    endOfToday.setHours(23, 59, 59, 999)

    const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)

    const subscriptions = [
      // Genuinely overdue, has a user → counts
      { status: "active", user_id: 1, renewal_date: tenDaysAgo, updatedAt: today },
      // Un-provisioned (no user bound) → excluded; cron never processes it
      { status: "active", user_id: null, renewal_date: tenDaysAgo, updatedAt: today },
      // Due LATER today (renewal_date <= end-of-day but still in the future) → excluded
      { status: "active", user_id: 2, renewal_date: endOfToday, updatedAt: today },
      // Not active → excluded
      { status: "paused", user_id: 3, renewal_date: tenDaysAgo, updatedAt: today },
    ]

    const metrics = await makeService(subscriptions).getDailyHealthMetrics(today)

    expect(metrics.subscriptions.pastDueSubscriptions).toBe(1)
  })
})

describe("HealthMetricsService paid vs free split", () => {
  it("counts paid active subscriptions separately from the raw active count", async () => {
    const now = new Date()
    const subscriptions = [
      { status: "active", amount: 250, user_id: 1, updatedAt: now },
      { status: "active", amount: 0, user_id: 2, updatedAt: now }, // free plan
      { status: "active", amount: null, user_id: 3, updatedAt: now }, // free plan (null)
      { status: "paused", amount: 250, user_id: 4, updatedAt: now }, // not active
    ]

    const metrics = await makeService(subscriptions).getDailyHealthMetrics(now)

    expect(metrics.subscriptions.activeSubscriptions).toBe(3)
    expect(metrics.subscriptions.paidActiveSubscriptions).toBe(1)
  })

  it("counts paid renewals separately from free ($0) renewals", async () => {
    const now = new Date()
    const transactions = [
      // Paid renewal (subscription-type, not a lifecycle event, amount > 0)
      { type: "subscription", memo: "Individual", status: "completed", amount: 250, square_transaction_id: "sq_paid" },
      // Free renewal ($0 plan) — counts as a renewal but not a paid one
      { type: "subscription", memo: "Free Agent", status: "completed", amount: 0, square_transaction_id: null },
      // Lifecycle event — not a renewal at all
      { type: "subscription", memo: "Subscription created", status: "completed", amount: 250, square_transaction_id: "sq_new" },
    ]

    const metrics = await makeService([], transactions).getDailyHealthMetrics(now)

    expect(metrics.subscriptions.successfulRenewals).toBe(2)
    expect(metrics.subscriptions.paidRenewals).toBe(1)
  })
})

describe("HealthMetricsService revenue de-duplication", () => {
  it("counts a single Square charge once even when recorded as both a payment and a subscription row", async () => {
    const now = new Date()
    // One $250 renewal charge written as the payment + subscription pair that the
    // renewal/purchase flows both produce, sharing one square_transaction_id.
    const transactions = [
      { type: "payment", status: "completed", amount: 250, square_transaction_id: "sq_charge_1" },
      { type: "subscription", memo: "Individual", status: "completed", amount: 250, square_transaction_id: "sq_charge_1" },
    ]

    const metrics = await makeService([], transactions).getDailyHealthMetrics(now)

    expect(metrics.payments.totalRevenue).toBe(250)
    expect(metrics.payments.successfulPayments).toBe(1)
    expect(metrics.payments.averageTransactionValue).toBe(250)
  })

  it("keeps rows without a square_transaction_id distinct (cannot be correlated)", async () => {
    const now = new Date()
    const transactions = [
      { type: "payment", status: "completed", amount: 100, square_transaction_id: null },
      { type: "payment", status: "completed", amount: 100, square_transaction_id: null },
    ]

    const metrics = await makeService([], transactions).getDailyHealthMetrics(now)

    expect(metrics.payments.totalRevenue).toBe(200)
    expect(metrics.payments.successfulPayments).toBe(2)
  })
})

describe("HealthMetricsService trials (Desk #1350)", () => {
  const DAY = 24 * 60 * 60 * 1000

  /**
   * In-memory Subscriptions, UserCards and PurchaseRequests. The three repository stubs apply the
   * same filters as the SQL in subscription.repository.ts (whose compiled statements are pinned in
   * subscription.repository.trials.test.ts), so deleting a card row or adding a paid renewal moves
   * the counts the way it would against MySQL.
   */
  function trialWorld() {
    const subscriptions: any[] = []
    const userCards: any[] = []
    const purchaseRequests: any[] = []
    const endsAt = (s: any) => {
      const trial = JSON.parse(s.data ?? "{}").trial
      return trial ? Date.parse(trial.ends_at) : NaN
    }
    const subscriptionRepository = {
      findAll: async () => subscriptions,
      findActiveTrials: async (now: Date) =>
        subscriptions.filter((s) => s.status === "active" && s.user_id != null && endsAt(s) > now.getTime()),
      findTrialsWithoutCard: async (now: Date) =>
        subscriptions.filter(
          (s) =>
            s.status === "active" &&
            s.user_id != null &&
            !s.cancel_on_renewal &&
            endsAt(s) > now.getTime() &&
            !userCards.some((c) => c.user_id === s.user_id && c.card_id)
        ),
      findEndedTrialsUnreconciled: async (now: Date) =>
        subscriptions.filter(
          (s) =>
            endsAt(s) < now.getTime() - DAY &&
            s.status !== "cancelled" &&
            !s.cancel_on_renewal &&
            s.payment_failure_count === 0 &&
            !purchaseRequests.some(
              (r) =>
                r.subscription_id === s.subscription_id &&
                r.request_type === "RENEWAL" &&
                r.status === "COMPLETED" &&
                r.amount_charged > 0
            )
        ),
    }
    const service = new HealthMetricsService(
      { findByDateRange: async () => [] } as any,
      subscriptionRepository as any,
      { findByDateRange: async () => [] } as any
    )
    return { subscriptions, userCards, purchaseRequests, service }
  }

  function trialSub(id: number, userId: number, endsAtMs: number, overrides: Record<string, any> = {}) {
    return {
      subscription_id: id,
      user_id: userId,
      product_id: 70,
      amount: 25000,
      status: "active",
      cancel_on_renewal: 0,
      payment_failure_count: 0,
      renewal_date: new Date(endsAtMs),
      data: JSON.stringify({ trial: { ends_at: new Date(endsAtMs).toISOString(), duration_days: 30 } }),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  it("flags a trial with no card (AC10: delete the card row, the count goes to 1)", async () => {
    const { subscriptions, userCards, service } = trialWorld()
    const now = Date.now()
    subscriptions.push(trialSub(70, 1, now + 20 * DAY), trialSub(71, 2, now + 3 * DAY))
    userCards.push({ id: 1, user_id: 1, card_id: "ccof:1" }, { id: 2, user_id: 2, card_id: "ccof:2" })

    const before = await service.getDailyHealthMetrics()
    expect(before.trials).toEqual({ active_trials: 2, ending_in_7d: 1, trials_without_card: 0, unreconciled_ended_trials: 0 })

    // The injected fault: user 1's card row is deleted.
    userCards.splice(0, 1)

    const after = await service.getDailyHealthMetrics()
    expect(after.trials.trials_without_card).toBe(1)
    expect(after.trials.active_trials).toBe(2)
  })

  it("does not flag a cancel-on-renewal trial with no card: it will never be charged", async () => {
    const { subscriptions, service } = trialWorld()
    subscriptions.push(trialSub(70, 1, Date.now() + 20 * DAY, { cancel_on_renewal: 1 }))

    const metrics = await service.getDailyHealthMetrics()
    expect(metrics.trials.trials_without_card).toBe(0)
  })

  it("reconciles ended trials (AC11: an unconverted one counts 1, a converted one 0)", async () => {
    const { subscriptions, userCards, purchaseRequests, service } = trialWorld()
    const twoDaysAgo = Date.now() - 2 * DAY
    // Ended two days ago; renewal_date was advanced or not, either way nothing visible happened.
    subscriptions.push(trialSub(80, 1, twoDaysAgo))
    // Ended two days ago and converted: a completed paid RENEWAL purchase request.
    subscriptions.push(trialSub(81, 2, twoDaysAgo))
    purchaseRequests.push({ subscription_id: 81, request_type: "RENEWAL", status: "COMPLETED", amount_charged: 25000 })
    userCards.push({ id: 1, user_id: 1, card_id: "ccof:1" }, { id: 2, user_id: 2, card_id: "ccof:2" })

    const metrics = await service.getDailyHealthMetrics()
    expect(metrics.trials.unreconciled_ended_trials).toBe(1)
    // Ended trials are not active trials, and their card state is not the live invariant.
    expect(metrics.trials.active_trials).toBe(0)
    expect(metrics.trials.trials_without_card).toBe(0)

    // Converting the first one clears the anomaly.
    purchaseRequests.push({ subscription_id: 80, request_type: "RENEWAL", status: "COMPLETED", amount_charged: 25000 })
    expect((await service.getDailyHealthMetrics()).trials.unreconciled_ended_trials).toBe(0)
  })

  it("counts an ended trial that cancelled, is failing visibly, or ended under a day ago as reconciled", async () => {
    const { subscriptions, purchaseRequests, service } = trialWorld()
    const twoDaysAgo = Date.now() - 2 * DAY
    subscriptions.push(
      trialSub(90, 1, twoDaysAgo, { status: "cancelled" }),
      trialSub(91, 2, twoDaysAgo, { cancel_on_renewal: 1 }),
      trialSub(92, 3, twoDaysAgo, { payment_failure_count: 1 }),
      trialSub(93, 4, Date.now() - 2 * 60 * 60 * 1000)
    )
    // A $0 or failed renewal is not a conversion.
    subscriptions.push(trialSub(94, 5, twoDaysAgo))
    purchaseRequests.push(
      { subscription_id: 94, request_type: "RENEWAL", status: "COMPLETED", amount_charged: 0 },
      { subscription_id: 94, request_type: "RENEWAL", status: "FAILED", amount_charged: 25000 }
    )

    const metrics = await service.getDailyHealthMetrics()
    expect(metrics.trials.unreconciled_ended_trials).toBe(1)
  })
})
