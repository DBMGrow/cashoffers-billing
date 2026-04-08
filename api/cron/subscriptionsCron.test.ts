import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock all external dependencies before importing the cron function
vi.mock("axios")
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
}))

vi.mock("@api/lib/repositories", () => ({
  subscriptionRepository: {
    findSubscriptionsForCronProcessing: vi.fn(),
    findExpiredTrials: vi.fn(),
    findTrialsExpiringSoon: vi.fn(),
    update: vi.fn(),
  },
  transactionRepository: {
    create: vi.fn(),
  },
}))

vi.mock("@api/use-cases/subscription", () => ({
  renewSubscriptionUseCase: {
    execute: vi.fn(),
  },
}))

vi.mock("@react-email/render", () => ({
  render: vi.fn().mockResolvedValue("<html>email</html>"),
}))

vi.mock("@api/infrastructure/email/templates/trial-expiring.email", () => ({
  default: () => null,
}))

vi.mock("@api/infrastructure/email/templates/trial-expired.email", () => ({
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

import axios from "axios"
import subscriptionsCron from "./subscriptionsCron"
import { subscriptionRepository, transactionRepository } from "@api/lib/repositories"
import { emailService, eventBus } from "@api/lib/services"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"

const mockAxios = vi.mocked(axios)
const mockSubscriptionRepo = vi.mocked(subscriptionRepository)
const mockTransactionRepo = vi.mocked(transactionRepository)
const mockEmailService = vi.mocked(emailService)
const mockEventBus = vi.mocked(eventBus)
const mockRenewUseCase = vi.mocked(renewSubscriptionUseCase)

const usersResponse = {
  data: {
    success: "success",
    data: [
      { user_id: 1, email: "user1@test.com", active: 1 },
      { user_id: 2, email: "user2@test.com", active: 1 },
      { user_id: 3, email: "inactive@test.com", active: 0 },
    ],
  },
}

describe("subscriptionsCron", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: users API returns successfully
    mockAxios.get = vi.fn().mockResolvedValue(usersResponse)

    // Default: no subscriptions to process
    mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findExpiredTrials = vi.fn().mockResolvedValue([])
    mockSubscriptionRepo.findTrialsExpiringSoon = vi.fn().mockResolvedValue([])
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

    it("should skip subscriptions marked for cancellation", async () => {
      mockSubscriptionRepo.findSubscriptionsForCronProcessing = vi.fn().mockResolvedValue([
        { subscription_id: 1, user_id: 1, cancel_on_renewal: 1, downgrade_on_renewal: 0 },
      ])

      await subscriptionsCron()

      expect(mockRenewUseCase.execute).not.toHaveBeenCalled()
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

  describe("Fatal Error Handling", () => {
    it("should send admin email when users API call fails", async () => {
      mockAxios.get = vi.fn().mockRejectedValue(new Error("API unreachable"))

      await subscriptionsCron()

      expect(mockEmailService.sendPlainEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Subscription Cron Error",
        })
      )
    })

    it("should log a failed transaction when users API call fails", async () => {
      mockAxios.get = vi.fn().mockRejectedValue(new Error("API unreachable"))

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
      mockAxios.get = vi.fn().mockRejectedValue(new Error("Fatal failure"))

      await expect(subscriptionsCron()).resolves.toBeUndefined()
    })

    it("should handle case where users API returns non-success response", async () => {
      mockAxios.get = vi.fn().mockResolvedValue({
        data: { success: "error", message: "Unauthorized" },
      })

      await subscriptionsCron()

      // Should send admin notification due to the "Error fetching users" throw
      expect(mockEmailService.sendPlainEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Subscription Cron Error" })
      )
    })
  })
})
