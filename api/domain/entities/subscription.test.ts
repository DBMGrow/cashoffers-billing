import { describe, it, expect } from "vitest"
import { Subscription } from "./subscription"
import { Money } from "../value-objects/money"
import { SubscriptionStatus } from "../value-objects/subscription-status"
import { Duration } from "../value-objects/duration"

describe("Subscription Entity", () => {
  const createTestSubscription = (overrides = {}) => {
    return Subscription.create({
      id: 1,
      userId: 1,
      subscriptionName: "CashOffers.PRO",
      productId: 1,
      amount: Money.fromCents(25000),
      duration: Duration.monthly(),
      renewalDate: new Date("2024-02-01"),
      nextRenewalAttempt: new Date("2024-02-01"),
      status: SubscriptionStatus.active(),
      data: null,
      cancelOnRenewal: false,
      downgradeOnRenewal: false,
      paymentFailureCount: 0,
      ...overrides,
    })
  }

  describe("Creation", () => {
    it("should create a valid subscription", () => {
      const subscription = createTestSubscription()

      expect(subscription.id).toBe(1)
      expect(subscription.userId).toBe(1)
      expect(subscription.subscriptionName).toBe("CashOffers.PRO")
      expect(subscription.amount.cents).toBe(25000)
      expect(subscription.isActive()).toBe(true)
    })

    it("should throw error for invalid userId", () => {
      expect(() =>
        createTestSubscription({ userId: 0 })
      ).toThrow("Subscription must have a valid userId")
    })

    it("should throw error for empty name", () => {
      expect(() =>
        createTestSubscription({ subscriptionName: "" })
      ).toThrow("Subscription must have a name")
    })

    it("should throw error for negative amount", () => {
      expect(() =>
        createTestSubscription({ amount: Money.fromCents(-100) })
      ).toThrow("Subscription amount cannot be negative")
    })

    it("should reconstitute from persistence", () => {
      const props = {
        id: 1,
        userId: 1,
        subscriptionName: "Test",
        productId: 1,
        amount: Money.fromCents(5000),
        duration: Duration.monthly(),
        renewalDate: new Date(),
        nextRenewalAttempt: null,
        status: SubscriptionStatus.active(),
        data: null,
        cancelOnRenewal: false,
        downgradeOnRenewal: false,
        paymentFailureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const subscription = Subscription.from(props)
      expect(subscription.id).toBe(1)
      expect(subscription.subscriptionName).toBe("Test")
    })
  })

  describe("Status Predicates", () => {
    it("should identify active subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.active(),
      })

      expect(subscription.isActive()).toBe(true)
      expect(subscription.isSuspended()).toBe(false)
      expect(subscription.isCancelled()).toBe(false)
    })

    it("should identify suspended subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
      })

      expect(subscription.isSuspended()).toBe(true)
      expect(subscription.isActive()).toBe(false)
    })

    it("should identify cancelled subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
      })

      expect(subscription.isCancelled()).toBe(true)
      expect(subscription.isActive()).toBe(false)
    })
  })

  describe("Business Rules - Cancellation", () => {
    it("should cancel active subscription", () => {
      const subscription = createTestSubscription()
      const cancelled = subscription.cancel()

      expect(cancelled.isCancelled()).toBe(true)
      expect(cancelled.id).toBe(subscription.id)
    })

    it("should cancel suspended subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
      })
      const cancelled = subscription.cancel()

      expect(cancelled.isCancelled()).toBe(true)
    })

    it("should not cancel already cancelled subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
      })

      expect(() => subscription.cancel()).toThrow("Cannot cancel subscription")
    })
  })

  describe("Business Rules - Suspension", () => {
    it("should suspend active subscription", () => {
      const subscription = createTestSubscription()
      const suspended = subscription.suspend()

      expect(suspended.isSuspended()).toBe(true)
    })

    it("should not suspend already suspended subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
      })

      expect(() => subscription.suspend()).toThrow("Cannot suspend subscription")
    })

    it("should not suspend cancelled subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
      })

      expect(() => subscription.suspend()).toThrow("Cannot suspend subscription")
    })
  })

  describe("Business Rules - Reactivation", () => {
    it("should reactivate suspended subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
      })
      const reactivated = subscription.reactivate()

      expect(reactivated.isActive()).toBe(true)
    })

    it("should not reactivate active subscription", () => {
      const subscription = createTestSubscription()

      expect(() => subscription.reactivate()).toThrow("Cannot reactivate subscription")
    })

    it("should not reactivate cancelled subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
      })

      expect(() => subscription.reactivate()).toThrow("Cannot reactivate subscription")
    })
  })

  describe("Business Rules - Renewal", () => {
    it("should renew active subscription", () => {
      const subscription = createTestSubscription({
        renewalDate: new Date("2024-01-01"),
      })

      const renewed = subscription.renew()

      expect(renewed.isActive()).toBe(true)
      expect(renewed.renewalDate).toEqual(new Date("2024-02-01"))
      expect(renewed.cancelOnRenewal).toBe(false)
      expect(renewed.downgradeOnRenewal).toBe(false)
    })

    it("should reactivate suspended subscription on renewal", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
        renewalDate: new Date("2024-01-01"),
      })

      const renewed = subscription.renew()

      expect(renewed.isActive()).toBe(true)
    })

    it("should cancel subscription marked for cancellation on renewal", () => {
      const subscription = createTestSubscription({
        renewalDate: new Date("2024-01-01"),
        cancelOnRenewal: true,
      })

      const renewed = subscription.renew()

      expect(renewed.isCancelled()).toBe(true)
    })

    it("should not renew if not due for renewal", () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const subscription = createTestSubscription({
        renewalDate: futureDate,
      })

      expect(subscription.canRenew()).toBe(false)
      expect(() => subscription.renew()).toThrow("Cannot renew subscription")
    })

    it("should not renew cancelled subscription", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
        renewalDate: new Date("2024-01-01"),
      })

      expect(() => subscription.renew()).toThrow("Cannot renew subscription")
    })
  })

  describe("Business Rules - Renewal Flags", () => {
    it("should mark for cancellation on renewal", () => {
      const subscription = createTestSubscription()
      const marked = subscription.markForCancellationOnRenewal()

      expect(marked.cancelOnRenewal).toBe(true)
    })

    it("should mark for downgrade on renewal", () => {
      const subscription = createTestSubscription()
      const marked = subscription.markForDowngradeOnRenewal()

      expect(marked.downgradeOnRenewal).toBe(true)
    })

    it("should not mark cancelled subscription for cancellation", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.cancelled(),
      })

      expect(() => subscription.markForCancellationOnRenewal()).toThrow(
        "Cannot mark for cancellation"
      )
    })

    it("should not mark suspended subscription for downgrade", () => {
      const subscription = createTestSubscription({
        status: SubscriptionStatus.suspended(),
      })

      expect(() => subscription.markForDowngradeOnRenewal()).toThrow("Cannot mark for downgrade")
    })
  })

  describe("Business Rules - Amount Updates", () => {
    it("should update subscription amount", () => {
      const subscription = createTestSubscription()
      const updated = subscription.updateAmount(Money.fromCents(30000))

      expect(updated.amount.cents).toBe(30000)
    })

    it("should not update to negative amount", () => {
      const subscription = createTestSubscription()

      expect(() => subscription.updateAmount(Money.fromCents(-1000))).toThrow(
        "Subscription amount cannot be negative"
      )
    })

    it("should allow zero amount", () => {
      const subscription = createTestSubscription()
      const updated = subscription.updateAmount(Money.fromCents(0))

      expect(updated.amount.cents).toBe(0)
    })
  })

  describe("Business Rules - Product Updates", () => {
    it("should update product and amount", () => {
      const subscription = createTestSubscription()
      const updated = subscription.updateProduct(2, Money.fromCents(30000))

      expect(updated.productId).toBe(2)
      expect(updated.amount.cents).toBe(30000)
    })

    it("should not update to negative amount", () => {
      const subscription = createTestSubscription()

      expect(() => subscription.updateProduct(2, Money.fromCents(-1000))).toThrow(
        "Subscription amount cannot be negative"
      )
    })
  })

  describe("Renewal Date Calculation", () => {
    it("should calculate monthly renewal correctly", () => {
      const subscription = createTestSubscription({
        duration: Duration.monthly(),
        renewalDate: new Date("2024-01-15"),
      })

      const renewed = subscription.renew()
      expect(renewed.renewalDate).toEqual(new Date("2024-02-15"))
    })

    it("should calculate yearly renewal correctly", () => {
      const subscription = createTestSubscription({
        duration: Duration.yearly(),
        renewalDate: new Date("2024-01-01"),
      })

      const renewed = subscription.renew()
      expect(renewed.renewalDate).toEqual(new Date("2025-01-01"))
    })

    it("should calculate weekly renewal correctly", () => {
      const subscription = createTestSubscription({
        duration: Duration.weekly(),
        renewalDate: new Date("2024-01-01"),
      })

      const renewed = subscription.renew()
      expect(renewed.renewalDate).toEqual(new Date("2024-01-08"))
    })
  })

  describe("Persistence", () => {
    it("should convert to object for persistence", () => {
      const subscription = createTestSubscription()
      const obj = subscription.toObject()

      expect(obj.id).toBe(1)
      expect(obj.userId).toBe(1)
      expect(obj.subscriptionName).toBe("CashOffers.PRO")
      expect(obj.amount.cents).toBe(25000)
    })
  })

  describe("Immutability", () => {
    it("should return new instance on mutations", () => {
      const subscription = createTestSubscription()
      const cancelled = subscription.cancel()

      expect(cancelled).not.toBe(subscription)
      expect(subscription.isActive()).toBe(true)
      expect(cancelled.isCancelled()).toBe(true)
    })

    it("should preserve original on amount update", () => {
      const subscription = createTestSubscription()
      const updated = subscription.updateAmount(Money.fromCents(30000))

      expect(subscription.amount.cents).toBe(25000)
      expect(updated.amount.cents).toBe(30000)
    })
  })
})
