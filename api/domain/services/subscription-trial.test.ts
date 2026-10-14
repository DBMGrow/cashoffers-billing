import { describe, it, expect } from "vitest"
import { trialDateDrift, TRIAL_DATE_DRIFT_TOLERANCE_MS } from "./subscription-trial"
import { HealthMetricsService } from "./health-metrics.service"

const trialData = (endsAt: string) => JSON.stringify({ trial: { ends_at: endsAt, duration_days: 30 } })

describe("trialDateDrift (D1, Desk #1350)", () => {
  it("returns both dates as ISO when ends_at and renewal_date disagree", () => {
    expect(
      trialDateDrift({
        data: trialData("2026-11-01T12:00:00.000Z"),
        renewal_date: new Date("2026-11-06T12:00:00.000Z"),
      })
    ).toEqual({ ends_at: "2026-11-01T12:00:00.000Z", renewal_date: "2026-11-06T12:00:00.000Z" })
  })

  it("returns null when they are the same instant", () => {
    expect(
      trialDateDrift({
        data: trialData("2026-11-01T12:00:00.000Z"),
        renewal_date: new Date("2026-11-01T12:00:00.000Z"),
      })
    ).toBeNull()
  })

  it("tolerates MySQL rounding renewal_date to the whole second", () => {
    expect(
      trialDateDrift({
        data: trialData("2026-11-01T12:00:00.678Z"),
        renewal_date: new Date("2026-11-01T12:00:01.000Z"),
      })
    ).toBeNull()
    expect(TRIAL_DATE_DRIFT_TOLERANCE_MS).toBe(1000)
  })

  it("flags a difference just past the tolerance, in either direction", () => {
    const endsAt = "2026-11-01T12:00:00.000Z"
    expect(
      trialDateDrift({ data: trialData(endsAt), renewal_date: new Date("2026-11-01T12:00:01.001Z") })
    ).not.toBeNull()
    expect(
      trialDateDrift({ data: trialData(endsAt), renewal_date: new Date("2026-11-01T11:59:58.999Z") })
    ).not.toBeNull()
  })

  it("accepts data as a parsed object and renewal_date as a string, as drivers hand them back", () => {
    expect(
      trialDateDrift({
        data: { trial: { ends_at: "2026-11-01T12:00:00.000Z", duration_days: 30 } },
        renewal_date: "2026-11-02T12:00:00.000Z",
      })
    ).toEqual({ ends_at: "2026-11-01T12:00:00.000Z", renewal_date: "2026-11-02T12:00:00.000Z" })
  })

  it("returns null with no trial marker, a malformed one, or no usable renewal_date", () => {
    expect(trialDateDrift({ data: JSON.stringify({ productData: {} }), renewal_date: new Date() })).toBeNull()
    expect(
      trialDateDrift({
        data: JSON.stringify({ trial: { ends_at: "not a date", duration_days: 30 } }),
        renewal_date: new Date(),
      })
    ).toBeNull()
    expect(trialDateDrift({ data: null, renewal_date: new Date() })).toBeNull()
    expect(trialDateDrift({ data: trialData("2026-11-01T12:00:00.000Z"), renewal_date: null })).toBeNull()
    expect(trialDateDrift({ data: trialData("2026-11-01T12:00:00.000Z"), renewal_date: "garbage" })).toBeNull()
  })
})

describe("the daily health report counts a trial date drift row (D1, AC24)", () => {
  it("the cron's error row is in the report's error count and recent errors, and is not marked critical", async () => {
    const driftRow = {
      level: "error",
      component: "subscriptionsCron",
      message:
        "Trial date drift: subscription 90 has ends_at 2026-11-01T12:00:00.000Z but renewal_date 2026-11-06T12:00:00.000Z",
      metadata: JSON.stringify({ subscription_id: 90 }),
      user_id: 1,
      createdAt: new Date(),
    }
    const service = new HealthMetricsService(
      { findByDateRange: async () => [] } as any,
      {
        findAll: async () => [],
        findActiveTrials: async () => [],
        findTrialsWithoutCard: async () => [],
        findEndedTrialsUnreconciled: async () => [],
      } as any,
      { findByDateRange: async () => [driftRow] } as any
    )

    const metrics = await service.getDailyHealthMetrics()

    expect(metrics.errors.totalErrors).toBe(1)
    expect(metrics.errors.criticalErrors).toBe(0)
    expect(metrics.errors.recentErrors[0].message).toContain("Trial date drift: subscription 90")
  })
})
