import { describe, it, expect } from "vitest"
import { HealthMetricsService } from "./health-metrics.service"

// Minimal repository stubs — the metrics we test touch
// transactionRepository.findByDateRange and subscriptionRepository.findAll.
const makeService = (subscriptions: any[], transactions: any[] = []) => {
  const transactionRepository = { findByDateRange: async () => transactions }
  const subscriptionRepository = { findAll: async () => subscriptions }
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
