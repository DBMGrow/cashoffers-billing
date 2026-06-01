import { describe, it, expect } from "vitest"
import { HealthMetricsService } from "./health-metrics.service"

// Minimal repository stubs — getSubscriptionMetrics only touches
// transactionRepository.findByDateRange and subscriptionRepository.findAll.
const makeService = (subscriptions: any[]) => {
  const transactionRepository = { findByDateRange: async () => [] }
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
