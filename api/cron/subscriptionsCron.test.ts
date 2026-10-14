import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock all external dependencies before importing the cron function
vi.mock("@api/lib/services", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
  emailService: {
    sendEmail: vi.fn(),
    sendPlainEmail: vi.fn(),
  },
  eventBus: {
    publish: vi.fn(),
    publishBatch: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
  whitelabelResolverService: {
    resolveForUser: vi.fn(),
  },
}))

vi.mock("@api/lib/repositories", () => ({
  subscriptionRepository: {
    findSubscriptionsForCronProcessing: vi.fn(),
    findExpiredTrials: vi.fn(),
    findTrialsExpiringSoon: vi.fn(),
    findTrialsEndingWithin: vi.fn(),
    stampTrialReminderSent: vi.fn(),
    findTrialsWithoutCard: vi.fn(),
    findEndedTrialsUnreconciled: vi.fn(),
    findUnconvertedTrials: vi.fn(),
    update: vi.fn(),
  },
  transactionRepository: {
    create: vi.fn(),
  },
  userCardRepository: {
    findByUserId: vi.fn(),
  },
}))

vi.mock("@api/use-cases/subscription", () => ({
  renewSubscriptionUseCase: {
    execute: vi.fn(),
  },
}))

// The cron fetches users directly from the DB (db.selectFrom("Users")...).
// Mock the Kysely query builder chain used by subscriptionsCron.getUser.
vi.mock("@api/lib/database", () => {
  const usersById: Record<number, { user_id: number; email: string; active: number }> = {
    1: { user_id: 1, email: "user1@test.com", active: 1 },
    2: { user_id: 2, email: "user2@test.com", active: 1 },
    3: { user_id: 3, email: "inactive@test.com", active: 0 },
  }
  return {
    db: {
      selectFrom: vi.fn(() => {
        let capturedUserId: number | undefined
        const chain: any = {
          selectAll: vi.fn(() => chain),
          where: vi.fn((col: string, _op: string, val: number) => {
            if (col === "user_id") capturedUserId = val
            return chain
          }),
          executeTakeFirst: vi.fn(async () =>
            capturedUserId != null ? usersById[capturedUserId] : undefined
          ),
        }
        return chain
      }),
    },
  }
})

vi.mock("@react-email/render", () => ({
  render: vi.fn().mockResolvedValue("<html>email</html>"),
}))

vi.mock("@api/infrastructure/email/templates/trial-expiring.email", () => ({
  default: () => null,
}))

vi.mock("@api/infrastructure/email/templates/trial-expired.email", () => ({
  default: () => null,
}))

vi.mock("@api/infrastructure/email/templates/trial-ending.email", () => ({
  default: () => null,
}))

vi.mock("@api/config/config.service", () => ({
  config: {
    api: {
      url: "http://localhost:3001",
      masterToken: "master_token",
    },
    adminEmail: "admin@test.com",
  },
}))

import subscriptionsCron from "./subscriptionsCron"
import { subscriptionRepository, transactionRepository, userCardRepository } from "@api/lib/repositories"
import { emailService, eventBus, whitelabelResolverService, logger } from "@api/lib/services"
import { render } from "@react-email/render"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"

const mockSubscriptionRepo = vi.mocked(subscriptionRepository)
const mockTransactionRepo = vi.mocked(transactionRepository)
const mockEmailService = vi.mocked(emailService)
const mockEventBus = vi.mocked(eventBus)
const mockRenewUseCase = vi.mocked(renewSubscriptionUseCase)
const mockUserCardRepo = vi.mocked(userCardRepository)
const mockWhitelabelResolver = vi.mocked(whitelabelResolverService)
const mockRender = vi.mocked(render)

describe("subscriptionsCron", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: no subscriptions to process
    mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findTrialsExpiringSoon = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findTrialsEndingWithin = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.stampTrialReminderSent = vi.fn().mockResolvedValue(true)
    mockSubscriptionRepo.findTrialsWithoutCard = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findEndedTrialsUnreconciled = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findUnconvertedTrials = vi.fn().mockResolvedValue([])
    mockUserCardRepo.findByUserId = vi.fn().mockResolvedValue([{ last_4: "4242" }])
    mockWhitelabelResolver.resolveForUser = vi.fn().mockResolvedValue({
      whitelabel_id: 1,
      code: "default",
      name: "InstantOffers",
      branding: { billing_url: "https://account.cashoffers.pro/" },
    } as any)
    mockSubscriptionRepo.update = vi.fn().mockResolvedValue({})
    mockTransactionRepo.create = vi.fn().mockResolvedValue({ transaction_id: 1 })
    mockEmailService.sendEmail = vi.fn().mockResolvedValue(undefined)
    mockEmailService.sendPlainEmail = vi.fn().mockResolvedValue(undefined)
    mockEventBus.publish = vi.fn().mockResolvedValue(undefined)
    mockRenewUseCase.execute = vi.fn().mockResolvedValue({ success: true, data: {} })
  })

  describe("Subscription Renewal", () => {
    it("should process subscriptions due for renewal", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 0, downgrade_on_renewal: 0 },
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).toHaveBeenCalledWith({
        subscriptionId: 1,
        email: "user1@test.com",
      })
    })

    it("should route cancel-on-renewal subscriptions to the renewal use case (which cancels them and applies the whitelabel suspension strategy)", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 1, downgrade_on_renewal: 0 },
      ])

      await subscriptionsCron()

      // Previously the cron short-circuited cancel_on_renewal with `continue`,
      // leaving the subscription stuck active. It must now reach the use case,
      // which detects cancelOnRenewal and cancels + emits SubscriptionCancelledEvent.
      expect(mockRenewUseCase.execute).toHaveBeenCalledWith({
        subscriptionId: 1,
        email: "user1@test.com",
      })
    })

    it("should skip subscriptions marked for downgrade", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 0, downgrade_on_renewal: 1 },
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).not.toHaveBeenCalled()
    })

    it("should skip subscriptions when user email is not found", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 999, cancel_on_renewal: 0, downgrade_on_renewal: 0 }, // user 999 not in users list
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).not.toHaveBeenCalled()
    })

    it("should skip subscriptions for inactive users", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 3, cancel_on_renewal: 0, downgrade_on_renewal: 0 }, // user 3 is inactive
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).not.toHaveBeenCalled()
    })

    it("should process multiple subscriptions", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 0, downgrade_on_renewal: 0 },
        { subscription_id: 2, user_id: 2, cancel_on_renewal: 0, downgrade_on_renewal: 0 },
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).toHaveBeenCalledTimes(2)
    })

    it("should continue processing remaining subscriptions after one fails", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 0, downgrade_on_renewal: 0 },
        { subscription_id: 2, user_id: 2, cancel_on_renewal: 0, downgrade_on_renewal: 0 },
      ])

      mockRenewUseCase.execute = vi.fn()
        .mockRejectedValueOnce(new Error("Payment failed"))
        .mockResolvedValueOnce({ success: true, data: {} })

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).toHaveBeenCalledTimes(2)
    })
  })

  describe("Expired Trials", () => {
    it("should cancel expired trials", async () => {
      mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([
        { subscription_id: 5, user_id: 1, subscription_name: "Free Trial" },
      ])

      await subscriptionsCron()

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ status: "cancelled" })
      )
    })

    it("should publish SubscriptionCancelledEvent for expired trials", async () => {
      mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([
        { subscription_id: 5, user_id: 1, subscription_name: "Free Trial" },
      ])

      await subscriptionsCron()

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "SubscriptionCancelled",
          payload: expect.objectContaining({
            subscriptionId: 5,
            userId: 1,
            reason: "trial_expired",
          }),
        })
      )
    })

    it("should send trial-expired email when user email is known", async () => {
      mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([
        { subscription_id: 5, user_id: 1, subscription_name: "Free Trial" },
      ])

      await subscriptionsCron()

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user1@test.com",
          subject: "Your Free Trial Has Expired",
        })
      )
    })

    it("should not send trial-expired email when user email is not found", async () => {
      mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([
        { subscription_id: 5, user_id: 999, subscription_name: "Free Trial" }, // unknown user
      ])

      await subscriptionsCron()

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
    })

    it("should continue processing other trials if one email fails", async () => {
      mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([
        { subscription_id: 5, user_id: 1, subscription_name: "Free Trial" },
        { subscription_id: 6, user_id: 2, subscription_name: "Free Trial" },
      ])

      mockEmailService.sendEmail = vi.fn()
        .mockRejectedValueOnce(new Error("Email failed"))
        .mockResolvedValueOnce(undefined)

      // Should not throw
      await expect(subscriptionsCron()).resolves.toBeUndefined()

      // Both trials should still be cancelled
      expect(mockSubscriptionRepo.update).toHaveBeenCalledTimes(2)
    })
  })

  describe("Trial Expiry Warnings", () => {
    it("should send warning emails for trials expiring soon", async () => {
      const renewalDate = new Date()
      renewalDate.setDate(renewalDate.getDate() + 8) // 8 days from now

      mockSubscriptionRepo.findTrialsExpiringSoon = vi.fn().mockResolvedValue([
        { subscription_id: 7, user_id: 1, renewal_date: renewalDate },
      ])

      await subscriptionsCron()

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user1@test.com",
          subject: expect.stringContaining("Your Free Trial Expires in"),
        })
      )
    })

    it("should not send warning email when user has no email", async () => {
      const renewalDate = new Date()
      renewalDate.setDate(renewalDate.getDate() + 8)

      mockSubscriptionRepo.findTrialsExpiringSoon = vi.fn().mockResolvedValue([
        { subscription_id: 7, user_id: 999, renewal_date: renewalDate }, // unknown user
      ])

      await subscriptionsCron()

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
    })
  })

  describe("Card trial ending reminder (Desk #1350)", () => {
    const DAY = 24 * 60 * 60 * 1000
    const endsAt = () => new Date(Date.now() + 5 * DAY).toISOString()

    /**
     * An in-memory Subscriptions table: `findTrialsEndingWithin` honours the same filters as the SQL
     * (active, not cancel-on-renewal, ending within the window, no reminder stamp) and
     * `stampTrialReminderSent` writes the stamp, so two runs exercise the real idempotency path.
     */
    function trialTable(rows: Array<Record<string, any>>) {
      mockSubscriptionRepo.findTrialsEndingWithin = vi.fn(async (days: number) => {
        const now = Date.now()
        return rows.filter((row) => {
          const trial = JSON.parse(row.data).trial
          const ends = Date.parse(trial.ends_at)
          return (
            row.status === "active" &&
            !row.cancel_on_renewal &&
            ends > now &&
            ends <= now + days * DAY &&
            trial.reminder_sent_at === undefined
          )
        })
      }) as any
      mockSubscriptionRepo.stampTrialReminderSent = vi.fn(async (id: number, sentAt: Date) => {
        const row = rows.find((r) => r.subscription_id === id)!
        const data = JSON.parse(row.data)
        data.trial.reminder_sent_at = sentAt.toISOString()
        row.data = JSON.stringify(data)
        return true
      }) as any
      return rows
    }

    function trialRow(overrides: Record<string, any> = {}) {
      return {
        subscription_id: 70,
        user_id: 1,
        subscription_name: "InstantOffers365 Individual",
        amount: 25000,
        status: "active",
        cancel_on_renewal: 0,
        square_environment: "production",
        data: JSON.stringify({ trial: { ends_at: endsAt(), duration_days: 30 } }),
        ...overrides,
      }
    }

    const trialEndingSends = () =>
      mockEmailService.sendEmail.mock.calls.filter(([arg]: any[]) => arg.templateName === "trial-ending")

    const renderedTrialEndingProps = () =>
      mockRender.mock.calls.map(([element]: any[]) => element?.props).find((p: any) => p?.manageUrl !== undefined)

    it("sends one trial-ending reminder across two runs and stamps reminder_sent_at", async () => {
      const [row] = trialTable([trialRow()])

      await subscriptionsCron()
      await subscriptionsCron()

      expect(mockSubscriptionRepo.findTrialsEndingWithin).toHaveBeenCalledWith(7)
      expect(trialEndingSends()).toHaveLength(1)
      expect(trialEndingSends()[0][0]).toEqual(
        expect.objectContaining({ to: "user1@test.com", templateName: "trial-ending", fromName: "InstantOffers" })
      )
      expect(mockSubscriptionRepo.stampTrialReminderSent).toHaveBeenCalledTimes(1)
      expect(JSON.parse(row.data).trial.reminder_sent_at).toEqual(expect.any(String))
    })

    it("renders the plan's own amount, the card's last four and the manage link", async () => {
      trialTable([trialRow({ amount: 99000, subscription_name: "InstantOffers365 Team" })])

      await subscriptionsCron()

      expect(renderedTrialEndingProps()).toEqual(
        expect.objectContaining({
          subscription: "InstantOffers365 Team",
          amount: "$990.00",
          cardLast4: "4242",
          manageUrl: "https://account.cashoffers.pro/manage",
          isSandbox: false,
        })
      )
    })

    it("sends nothing to a cancelled trial", async () => {
      trialTable([trialRow({ cancel_on_renewal: 1 }), trialRow({ subscription_id: 71, status: "cancelled" })])

      await subscriptionsCron()

      expect(trialEndingSends()).toHaveLength(0)
      expect(mockSubscriptionRepo.stampTrialReminderSent).not.toHaveBeenCalled()
    })

    it("does not stamp when the send fails, so the next run retries", async () => {
      trialTable([trialRow()])
      mockEmailService.sendEmail = vi.fn().mockRejectedValueOnce(new Error("SMTP down")).mockResolvedValue(undefined)

      await subscriptionsCron()
      expect(mockSubscriptionRepo.stampTrialReminderSent).not.toHaveBeenCalled()

      await subscriptionsCron()
      expect(mockSubscriptionRepo.stampTrialReminderSent).toHaveBeenCalledTimes(1)
      expect(trialEndingSends()).toHaveLength(2)
    })

    // D1, AC21. The trial's renewal_date was moved 5 days later; the repository's update moved
    // ends_at with it (AC20), so the row now names the new date in both.
    describe("after renewal_date moved 5 days later (D1, AC21)", () => {
      const OLD_END = new Date("2026-11-13T18:00:00.000Z")
      const NEW_END = new Date(OLD_END.getTime() + 5 * DAY)
      const movedRow = () =>
        trialRow({
          renewal_date: NEW_END,
          data: JSON.stringify({ trial: { ends_at: NEW_END.toISOString(), duration_days: 30 } }),
        })
      afterEach(() => vi.useRealTimers())

      it("sends nothing 7 days before the old date", async () => {
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date(OLD_END.getTime() - 7 * DAY + 60_000))
        trialTable([movedRow()])

        await subscriptionsCron()

        expect(trialEndingSends()).toHaveLength(0)
      })

      it("sends exactly one reminder 7 days before the new date, naming the new date", async () => {
        vi.useFakeTimers({ toFake: ["Date"] })
        trialTable([movedRow()])

        vi.setSystemTime(new Date(NEW_END.getTime() - 7 * DAY + 60_000))
        await subscriptionsCron()
        vi.setSystemTime(new Date(NEW_END.getTime() - 6 * DAY))
        await subscriptionsCron()

        const newDate = NEW_END.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        expect(trialEndingSends()).toHaveLength(1)
        expect(trialEndingSends()[0][0].subject).toBe(`Your free trial ends on ${newDate}`)
        expect(renderedTrialEndingProps().chargeDate).toBe(newDate)
      })
    })

    it("still sends with no card row, naming the card on file", async () => {
      trialTable([trialRow()])
      mockUserCardRepo.findByUserId = vi.fn().mockResolvedValue([])

      await subscriptionsCron()

      expect(trialEndingSends()).toHaveLength(1)
      expect(renderedTrialEndingProps().cardLast4).toBeUndefined()
    })
  })

  describe("Card trial invariants (Desk #1350)", () => {
    const DAY = 24 * 60 * 60 * 1000
    /** The child logger the cron created on this run (the logger mock hands out a fresh one per call). */
    const cronLogger = () => vi.mocked(logger.child).mock.results[0].value as { error: ReturnType<typeof vi.fn> }

    function trialSub(id: number, userId: number) {
      return {
        subscription_id: id,
        user_id: userId,
        product_id: 70,
        status: "active",
        cancel_on_renewal: 0,
        data: JSON.stringify({ trial: { ends_at: new Date(Date.now() + 20 * DAY).toISOString(), duration_days: 30 } }),
      }
    }

    it("flags a trial with no card: an error log names the subscription, user and product", async () => {
      // The trialing subscription whose UserCards row was deleted (the repository query's result).
      mockSubscriptionRepo.findTrialsWithoutCard = vi.fn().mockResolvedValue([trialSub(70, 1)])

      await subscriptionsCron()

      expect(mockSubscriptionRepo.findTrialsWithoutCard).toHaveBeenCalledWith(expect.any(Date))
      expect(cronLogger().error).toHaveBeenCalledWith("Trial has no card on file: subscription 70", undefined, {
        subscription_id: 70,
        user_id: 1,
        product_id: 70,
        subjectUserId: 1,
      })
    })

    it("logs each unreconciled ended trial at error", async () => {
      mockSubscriptionRepo.findEndedTrialsUnreconciled = vi.fn().mockResolvedValue([trialSub(80, 2), trialSub(81, 3)])

      await subscriptionsCron()

      const unreconciled = cronLogger().error.mock.calls.filter(([msg]: any[]) => String(msg).startsWith("Ended trial not reconciled"))
      expect(unreconciled.map(([, , meta]: any[]) => meta.subscription_id)).toEqual([80, 81])
    })

    describe("trial date drift (D1, AC24)", () => {
      function unconvertedTrial(id: number, endsAt: string, renewalDate: Date) {
        return { ...trialSub(id, 1), renewal_date: renewalDate, data: JSON.stringify({ trial: { ends_at: endsAt, duration_days: 30 } }) }
      }
      const driftErrors = () =>
        cronLogger().error.mock.calls.filter(([msg]: any[]) => String(msg).startsWith("Trial date drift"))

      it("logs one error naming the subscription, both dates and 'Trial date drift' when ends_at and renewal_date disagree", async () => {
        mockSubscriptionRepo.findUnconvertedTrials = vi
          .fn()
          .mockResolvedValue([unconvertedTrial(90, "2026-11-01T12:00:00.000Z", new Date("2026-11-06T12:00:00.000Z"))])

        await subscriptionsCron()

        expect(mockSubscriptionRepo.findUnconvertedTrials).toHaveBeenCalledTimes(1)
        expect(driftErrors()).toHaveLength(1)
        const [message, error, meta] = driftErrors()[0]
        expect(message).toBe(
          "Trial date drift: subscription 90 has ends_at 2026-11-01T12:00:00.000Z but renewal_date 2026-11-06T12:00:00.000Z"
        )
        expect(error).toBeUndefined()
        expect(meta).toEqual({
          subscription_id: 90,
          user_id: 1,
          product_id: 70,
          ends_at: "2026-11-01T12:00:00.000Z",
          renewal_date: "2026-11-06T12:00:00.000Z",
          subjectUserId: 1,
        })
      })

      it("is silent when the dates agree, including MySQL's rounding of renewal_date to the second", async () => {
        mockSubscriptionRepo.findUnconvertedTrials = vi.fn().mockResolvedValue([
          unconvertedTrial(91, "2026-11-01T12:00:00.000Z", new Date("2026-11-01T12:00:00.000Z")),
          unconvertedTrial(92, "2026-11-01T12:00:00.678Z", new Date("2026-11-01T12:00:01.000Z")),
        ])

        await subscriptionsCron()

        expect(driftErrors()).toHaveLength(0)
        expect(cronLogger().error).not.toHaveBeenCalled()
      })

      it("logs each drifting trial and only those", async () => {
        mockSubscriptionRepo.findUnconvertedTrials = vi.fn().mockResolvedValue([
          unconvertedTrial(93, "2026-11-01T12:00:00.000Z", new Date("2026-10-20T00:00:00.000Z")),
          unconvertedTrial(94, "2026-11-01T12:00:00.000Z", new Date("2026-11-01T12:00:00.000Z")),
          unconvertedTrial(95, "2026-12-01T12:00:00.000Z", new Date("2026-11-01T12:00:00.000Z")),
        ])

        await subscriptionsCron()

        expect(driftErrors().map(([, , meta]: any[]) => meta.subscription_id)).toEqual([93, 95])
      })

      it("is read-only: a drifting trial is reported, not corrected", async () => {
        mockSubscriptionRepo.findUnconvertedTrials = vi
          .fn()
          .mockResolvedValue([unconvertedTrial(96, "2026-11-01T12:00:00.000Z", new Date("2026-11-09T12:00:00.000Z"))])

        await subscriptionsCron()

        expect(mockSubscriptionRepo.update).not.toHaveBeenCalled()
        expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
      })
    })

    it("logs nothing when every trial has a card and every ended trial reconciled", async () => {
      await subscriptionsCron()

      expect(cronLogger().error).not.toHaveBeenCalled()
    })

    it("is read-only and never charges, emails or writes", async () => {
      mockSubscriptionRepo.findTrialsWithoutCard = vi.fn().mockResolvedValue([trialSub(70, 1)])
      mockSubscriptionRepo.findEndedTrialsUnreconciled = vi.fn().mockResolvedValue([trialSub(80, 2)])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).not.toHaveBeenCalled()
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled()
      expect(mockTransactionRepo.create).not.toHaveBeenCalled()
    })

    it("a failing invariant query is logged and does not fail the cron", async () => {
      mockSubscriptionRepo.findTrialsWithoutCard = vi.fn().mockRejectedValue(new Error("query timeout"))

      await expect(subscriptionsCron()).resolves.toBeUndefined()
      expect(cronLogger().error).toHaveBeenCalledWith("Error checking card-on-file trial invariants", expect.any(Error))
      expect(mockEmailService.sendPlainEmail).not.toHaveBeenCalled()
    })
  })

  describe("Fatal Error Handling", () => {
    it("should send admin email when loading subscriptions fails", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi
        .fn()
        .mockRejectedValue(new Error("DB unreachable"))

      await subscriptionsCron()

      expect(mockEmailService.sendPlainEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Subscription Cron Error",
        })
      )
    })

    it("should log a failed transaction when loading subscriptions fails", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi
        .fn()
        .mockRejectedValue(new Error("DB unreachable"))

      await subscriptionsCron()

      expect(mockTransactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cron",
          status: "failed",
          memo: "Subscriptions failed",
        })
      )
    })

    it("should not throw when the cron encounters a fatal error", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi
        .fn()
        .mockRejectedValue(new Error("Fatal failure"))

      await expect(subscriptionsCron()).resolves.toBeUndefined()
    })
  })
})
