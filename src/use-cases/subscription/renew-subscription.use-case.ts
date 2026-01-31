import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { IConfigService } from "@/config/config.interface"
import { IRenewSubscriptionUseCase } from "./renew-subscription.use-case.interface"
import { RenewSubscriptionInput, RenewSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { RenewSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  subscriptionRepository: ISubscriptionRepository
  transactionRepository: ITransactionRepository
  userCardRepository: IUserCardRepository
  config: IConfigService
}

interface LineItem {
  item: string
  price: number
}

/**
 * RenewSubscriptionUseCase
 *
 * Handles subscription renewal with:
 * - Payment processing for base subscription
 * - Support for addon charges (e.g., HomeUptick)
 * - Renewal date calculation based on duration
 * - Retry logic with escalating intervals (1, 3, 7 days)
 * - Email notifications (success/failure)
 * - Transaction logging
 */
export class RenewSubscriptionUseCase implements IRenewSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: RenewSubscriptionInput): Promise<UseCaseResult<RenewSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = RenewSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Renewal validation failed", { errors, input })
        return failure(errors, "RENEWAL_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Processing subscription renewal", {
        subscriptionId: validatedInput.subscriptionId,
      })

      // Get subscription
      const subscription = await this.deps.subscriptionRepository.findById(
        validatedInput.subscriptionId
      )
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      // Build line items for charges
      const lineItems: LineItem[] = [
        {
          item: subscription.subscription_name || "Subscription",
          price: subscription.amount || 0,
        },
      ]

      let totalAmount = subscription.amount || 0

      // TODO: Add HomeUptick addon support when we have the service abstraction
      // For now, we'll just use the base subscription amount

      // Process payment if amount > 0
      if (totalAmount > 0) {
        await this.processRenewalPayment(
          subscription.user_id!,
          validatedInput.email,
          totalAmount,
          subscription.subscription_name || "Subscription",
          lineItems
        )
      }

      // Calculate new renewal date
      const newRenewalDate = this.calculateNextRenewalDate(
        subscription.renewal_date!,
        subscription.duration!
      )

      // Update subscription
      const now = new Date()
      await this.deps.subscriptionRepository.update(validatedInput.subscriptionId, {
        renewal_date: newRenewalDate,
        next_renewal_attempt: newRenewalDate,
        updatedAt: now,
      })

      // Reactivate if suspended
      if (subscription.status === "suspend") {
        await this.deps.subscriptionRepository.update(validatedInput.subscriptionId, {
          status: "active",
          updatedAt: now,
        })
      }

      // Send renewal email
      await this.sendRenewalEmail(
        validatedInput.email,
        subscription.subscription_name || "Subscription",
        totalAmount,
        newRenewalDate,
        lineItems
      )

      // Log transaction
      await this.deps.transactionRepository.create({
        user_id: subscription.user_id!,
        amount: totalAmount,
        type: "subscription",
        memo: subscription.subscription_name || "Subscription renewal",
        status: "completed",
        data: JSON.stringify({ renewalDate: newRenewalDate }),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Subscription renewal completed", {
        subscriptionId: validatedInput.subscriptionId,
        amount: totalAmount,
        nextRenewalDate: newRenewalDate,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: validatedInput.subscriptionId,
        transactionId: "", // Would be set from transaction creation
        nextRenewalDate: newRenewalDate,
        amount: totalAmount,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Subscription renewal error", {
        error: errorMessage,
        subscriptionId: input.subscriptionId,
        duration: Date.now() - startTime,
      })

      // Handle renewal failure
      await this.handleRenewalFailure(input.subscriptionId, input.email, errorMessage)

      return failure(errorMessage, "RENEWAL_ERROR")
    }
  }

  private async processRenewalPayment(
    userId: number,
    email: string,
    amount: number,
    subscriptionName: string,
    lineItems: LineItem[]
  ): Promise<void> {
    const { logger, paymentProvider, userCardRepository } = this.deps

    // Get user's card
    const userCards = await userCardRepository.findByUserId(userId)
    if (!userCards || userCards.length === 0) {
      throw new Error("No payment card found for user")
    }

    const userCard = userCards[0]
    if (!userCard.card_id || !userCard.square_customer_id) {
      throw new Error("Incomplete card information")
    }

    // Create payment
    const payment = await paymentProvider.createPayment({
      sourceId: userCard.card_id,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount: BigInt(amount),
        currency: "USD",
      },
      customerId: userCard.square_customer_id,
      note: `Renewal: ${subscriptionName}`,
    })

    if (payment.status !== "COMPLETED") {
      throw new Error("Payment failed")
    }

    logger.info("Renewal payment processed", {
      userId,
      amount,
      paymentId: payment.id,
    })
  }

  private calculateNextRenewalDate(currentRenewalDate: Date, duration: string): Date {
    const newDate = new Date(currentRenewalDate)
    const durationLower = duration.toLowerCase()

    switch (durationLower) {
      case "daily":
        newDate.setDate(newDate.getDate() + 1)
        break
      case "weekly":
        newDate.setDate(newDate.getDate() + 7)
        break
      case "monthly":
        newDate.setMonth(newDate.getMonth() + 1)
        break
      case "yearly":
        newDate.setFullYear(newDate.getFullYear() + 1)
        break
      default:
        throw new Error(`Invalid duration: ${duration}`)
    }

    return newDate
  }

  private async sendRenewalEmail(
    email: string,
    subscriptionName: string,
    amount: number,
    renewalDate: Date,
    lineItems: LineItem[]
  ): Promise<void> {
    const lineItemsHtml = lineItems
      .map((item) => `<li>${item.item}: $${(item.price / 100).toFixed(2)}</li>`)
      .join("")

    await this.deps.emailService.sendEmail({
      to: email,
      subject: "Subscription Renewal",
      template: "subscriptionRenewal.html",
      fields: {
        amount: `$${(amount / 100).toFixed(2)}`,
        date: renewalDate.toLocaleDateString(),
        subscription: subscriptionName,
        lineItems: `<ul>${lineItemsHtml}</ul>`,
      },
    })
  }

  private async handleRenewalFailure(
    subscriptionId: number,
    email: string,
    error: string
  ): Promise<void> {
    const { logger, emailService, subscriptionRepository, transactionRepository, config } =
      this.deps

    try {
      // Get subscription for details
      const subscription = await subscriptionRepository.findById(subscriptionId)
      if (!subscription) return

      // Send failure email to user
      await emailService.sendEmail({
        to: email,
        subject: "Subscription Renewal Failed",
        template: "subscriptionRenewalFailed.html",
        fields: {
          subscription: subscription.subscription_name || "Subscription",
          date: new Date().toLocaleDateString(),
          link: config.get("FRONTEND_URL")
            ? `${config.get("FRONTEND_URL")}/manage?email=${email}`
            : "",
        },
      })

      // Update next renewal attempt with escalating retry logic
      const nextAttempt = this.calculateNextRetryAttempt(subscription.next_renewal_attempt)
      const now = new Date()
      await subscriptionRepository.update(subscriptionId, {
        next_renewal_attempt: nextAttempt,
        updatedAt: now,
      })

      // Log failed transaction
      await transactionRepository.create({
        user_id: subscription.user_id!,
        amount: subscription.amount || 0,
        type: "subscription",
        memo: `${subscription.subscription_name || "Subscription"} (failed)`,
        status: "failed",
        data: JSON.stringify({ error }),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Renewal failure handled", {
        subscriptionId,
        nextAttempt,
        error,
      })
    } catch (failureError) {
      logger.error("Failed to handle renewal failure", { error: failureError })
    }
  }

  private calculateNextRetryAttempt(lastAttempt: Date | null): Date {
    const today = new Date()

    if (!lastAttempt) {
      // First failure, retry in 1 day
      const nextAttempt = new Date(today)
      nextAttempt.setDate(today.getDate() + 1)
      return nextAttempt
    }

    // Calculate days since last attempt
    const daysWaited = (today.getTime() - new Date(lastAttempt).getTime()) / (1000 * 60 * 60 * 24)

    let daysToAdd = 7 // Default to 7 days

    if (daysWaited <= 1) {
      daysToAdd = 1 // First retry after 1 day
    } else if (daysWaited <= 4) {
      daysToAdd = 3 // Second retry after 3 days
    }
    // After that, retry every 7 days

    const nextAttempt = new Date(today)
    nextAttempt.setDate(today.getDate() + daysToAdd)
    return nextAttempt
  }
}
