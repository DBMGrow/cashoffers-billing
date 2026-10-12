import { describe, it, expect, vi, beforeEach } from "vitest"
import { HealthReportService } from "./health-report.service"
import type { DailyHealthMetrics, IHealthMetricsService } from "./health-metrics.service"
import type { IEmailService } from "@api/infrastructure/email/email-service.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"

const metrics: DailyHealthMetrics = {
  reportDate: new Date("2026-06-08T00:00:00Z"),
  startDate: new Date("2026-06-07T00:00:00Z"),
  endDate: new Date("2026-06-08T00:00:00Z"),
  subscriptions: {
    successfulRenewals: 10,
    paidRenewals: 4,
    failedRenewals: 0,
    newSubscriptions: 2,
    cancelledSubscriptions: 1,
    activeSubscriptions: 100,
    paidActiveSubscriptions: 40,
    subscriptionsInRetry: 0,
    pausedSubscriptions: 0,
    pastDueSubscriptions: 0,
  },
  payments: {
    totalRevenue: 50000,
    successfulPayments: 10,
    failedPayments: 0,
    refunds: 0,
    averageTransactionValue: 5000,
  },
  errors: { totalErrors: 0, criticalErrors: 0, recentErrors: [] },
  failureReasons: [],
  trials: { active_trials: 3, ending_in_7d: 1, trials_without_card: 0, unreconciled_ended_trials: 0 },
}

const makeLogger = (): ILogger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(function (this: ILogger) {
    return this
  }),
})

describe("HealthReportService.sendDailyHealthReport", () => {
  let metricsService: IHealthMetricsService
  let emailService: IEmailService
  let logger: ILogger

  beforeEach(() => {
    metricsService = { getDailyHealthMetrics: vi.fn().mockResolvedValue(metrics) }
    emailService = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
      sendPlainEmail: vi.fn().mockResolvedValue(undefined),
    }
    logger = makeLogger()
  })

  const service = () => new HealthReportService(metricsService, emailService, logger)

  it("sends to every recipient when all succeed", async () => {
    await service().sendDailyHealthReport(["a@x.com", "b@x.com", "c@x.com"])

    expect(emailService.sendEmail).toHaveBeenCalledTimes(3)
    expect(logger.info).toHaveBeenCalledWith(
      "Daily health report sent successfully",
      expect.objectContaining({ recipientCount: 3 })
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("continues sending after one recipient fails", async () => {
    vi.mocked(emailService.sendEmail).mockImplementation(async ({ to }) => {
      if (to === "bad@x.com") throw new Error("bounced")
    })

    await service().sendDailyHealthReport(["good1@x.com", "bad@x.com", "good2@x.com"])

    // All three were attempted despite the middle one throwing.
    expect(emailService.sendEmail).toHaveBeenCalledTimes(3)
    expect(logger.warn).toHaveBeenCalledWith(
      "Daily health report sent with partial failures",
      expect.objectContaining({ sentCount: 2, failures: ["bad@x.com"] })
    )
  })

  it("throws only when every recipient fails", async () => {
    vi.mocked(emailService.sendEmail).mockRejectedValue(new Error("smtp down"))

    await expect(
      service().sendDailyHealthReport(["a@x.com", "b@x.com"])
    ).rejects.toThrow("Daily health report failed to send to all recipients")

    expect(emailService.sendEmail).toHaveBeenCalledTimes(2)
  })

  it("throws without attempting sends when report building fails", async () => {
    vi.mocked(metricsService.getDailyHealthMetrics).mockRejectedValue(new Error("db down"))

    await expect(service().sendDailyHealthReport(["a@x.com"])).rejects.toThrow("db down")

    expect(emailService.sendEmail).not.toHaveBeenCalled()
  })
})

describe("HealthReportService free trials (Desk #1350)", () => {
  const sentHtml = async (trials: DailyHealthMetrics["trials"]) => {
    const emailService: IEmailService = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
      sendPlainEmail: vi.fn().mockResolvedValue(undefined),
    }
    const metricsService: IHealthMetricsService = {
      getDailyHealthMetrics: vi.fn().mockResolvedValue({ ...metrics, trials }),
    }
    await new HealthReportService(metricsService, emailService, makeLogger()).sendDailyHealthReport(["a@x.com"])
    return vi.mocked(emailService.sendEmail).mock.calls[0][0].html as string
  }

  it("renders the Free Trials row, gray and healthy when there are no anomalies", async () => {
    const html = await sentHtml({ active_trials: 3, ending_in_7d: 1, trials_without_card: 0, unreconciled_ended_trials: 0 })

    expect(html).toContain("Free Trials")
    expect(html).toContain("Trials Without a Card")
    expect(html).toContain("Ended Trials Not Reconciled")
    expect(html).not.toContain("#dc2626")
    expect(html).toContain("All systems operating normally.")
  })

  it("renders a trial with no card red, warns and adds an action item", async () => {
    const html = await sentHtml({ active_trials: 3, ending_in_7d: 1, trials_without_card: 1, unreconciled_ended_trials: 0 })

    expect(html).toContain("#dc2626")
    expect(html).toContain("1 free trial anomaly: 1 without a card, 0 ended and not reconciled.")
    expect(html).toContain("have no card on file")
  })

  it("renders an unreconciled ended trial red and adds an action item", async () => {
    const html = await sentHtml({ active_trials: 0, ending_in_7d: 0, trials_without_card: 0, unreconciled_ended_trials: 2 })

    expect(html).toContain("#dc2626")
    expect(html).toContain("2 free trial anomalies")
    expect(html).toContain("ended over a day ago with no paid renewal")
  })
})
