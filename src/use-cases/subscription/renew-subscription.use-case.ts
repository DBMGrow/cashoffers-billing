import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { IPurchaseRequestRepository } from "@/infrastructure/database/repositories/purchase-request.repository.interface"
import { IConfigService } from "@/config/config.interface"
import { ITransactionManager } from "@/infrastructure/database/transaction/transaction-manager.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { IRenewSubscriptionUseCase } from "./renew-subscription.use-case.interface"
import { RenewSubscriptionInput, RenewSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { RenewSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"
import { SubscriptionMapper } from "@/domain"
import { SubscriptionRenewedEvent } from "@/domain/events/subscription-renewed.event"
import { PaymentProcessedEvent } from "@/domain/events/payment-processed.event"
import { PaymentFailedEvent } from "@/domain/events/payment-failed.event"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  subscriptionRepository: ISubscriptionRepository
  transactionRepository: ITransactionRepository
  userCardRepository: IUserCardRepository
  purchaseRequestRepository: IPurchaseRequestRepository
  config: IConfigService
  transactionManager: ITransactionManager
  eventBus: IEventBus
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
    const startTime = new Date()
    let purchaseRequestId: number | null = null

    try {
      // Validate input with Zod
      const validationResult = RenewSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Renewal validation failed", { errors, input })
        return failure(errors, "RENEWAL_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data

      // Get subscription first to populate purchase request data
      const subscription = await this.deps.subscriptionRepository.findById(
        validatedInput.subscriptionId
      )
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      if (!subscription.product_id) {
        logger.error("Subscription missing product_id", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription has no product", "INVALID_SUBSCRIPTION")
      }

      // 0. Create PurchaseRequest for tracking (status: PENDING, type: RENEWAL, source: CRON)
      const purchaseRequest = await this.deps.purchaseRequestRepository.create({
        request_uuid: uuidv4(),
        request_type: "RENEWAL",
        source: "CRON",
        user_id: subscription.user_id,
        email: validatedInput.email,
        product_id: subscription.product_id,
        subscription_id: validatedInput.subscriptionId,
        request_data: JSON.stringify(validatedInput),
        status: "PENDING",
        idempotency_key: null,
      })
      purchaseRequestId = purchaseRequest.request_id

      logger.info("Processing subscription renewal", {
        purchaseRequestId,
        subscriptionId: validatedInput.subscriptionId,
      })

      // Update status to VALIDATING
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "VALIDATING")

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

      // Convert to domain entity
      const subscriptionEntity = SubscriptionMapper.toDomain(subscription as any)

      // Check if subscription should be cancelled on renewal
      if (subscriptionEntity.cancelOnRenewal) {
        const cancelledEntity = subscriptionEntity.cancel()
        await this.deps.subscriptionRepository.update(
          validatedInput.subscriptionId,
          SubscriptionMapper.toDatabase(cancelledEntity) as any
        )

        // Mark purchase request as completed (cancellation case - no payment)
        await this.deps.purchaseRequestRepository.markAsCompleted(
          purchaseRequestId,
          {
            subscriptionId: validatedInput.subscriptionId,
            transactionId: null,
            amountCharged: 0,
            cardId: null,
          },
          startTime
        )

        logger.info("Subscription cancelled on renewal", {
          subscriptionId: validatedInput.subscriptionId,
        })

        return success({
          subscriptionId: validatedInput.subscriptionId,
          transactionId: "",
          nextRenewalDate: cancelledEntity.renewalDate,
          amount: 0,
        })
      }

      // Update status to PROCESSING_PAYMENT
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")

      // Process payment if amount > 0
      let paymentId: string | null = null
      let cardId: string | null = null
      let paymentEnvironment: 'production' | 'sandbox' = 'production'
      if (totalAmount > 0) {
        const paymentResult = await this.processRenewalPayment(
          subscription.user_id!,
          validatedInput.email,
          totalAmount,
          subscription.subscription_name || "Subscription",
          lineItems,
          validatedInput.subscriptionId
        )
        paymentId = paymentResult.paymentId
        cardId = paymentResult.cardId
        paymentEnvironment = paymentResult.environment
      }

      // Update status to CREATING_SUBSCRIPTION (updating renewal)
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")

      // Use domain entity to handle renewal logic
      const renewedEntity = subscriptionEntity.renew()
      const newRenewalDate = renewedEntity.renewalDate

      let transactionId: number | null = null

      // Update subscription and log transaction atomically
      await this.deps.transactionManager.runInTransaction(async (trx) => {
        // Update subscription with renewed entity data
        await this.deps.subscriptionRepository.update(
          validatedInput.subscriptionId,
          SubscriptionMapper.toDatabase(renewedEntity) as any,
          trx
        )

        // Log transaction
        const now = new Date()
        const transaction = await this.deps.transactionRepository.create({
          user_id: subscription.user_id!,
          amount: totalAmount,
          type: "subscription",
          memo: subscription.subscription_name || "Subscription renewal",
          status: "completed",
          square_transaction_id: paymentId || undefined,
          square_environment: paymentEnvironment, // Track which Square environment was used
          data: JSON.stringify({ renewalDate: newRenewalDate }),
          createdAt: now,
          updatedAt: now,
        }, trx)
        transactionId = transaction.transaction_id
      })

      // Update status to FINALIZING
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")

      // Publish domain events for subscription renewal
      await this.deps.eventBus.publish(
        SubscriptionRenewedEvent.create({
          subscriptionId: validatedInput.subscriptionId,
          userId: subscription.user_id!,
          email: validatedInput.email,
          productId: subscription.product_id,
          productName: subscription.subscription_name || "Subscription",
          amount: totalAmount,
          transactionId: transactionId || undefined,
          cardId: cardId || undefined,
          nextRenewalDate: newRenewalDate,
          environment: paymentEnvironment, // Include environment in event
        })
      )

      // Publish payment processed event if payment was made
      if (paymentId && totalAmount > 0) {
        await this.deps.eventBus.publish(
          PaymentProcessedEvent.create({
            transactionId: transactionId!,
            externalTransactionId: paymentId,
            userId: subscription.user_id!,
            email: validatedInput.email,
            amount: totalAmount,
            currency: "USD",
            cardId: cardId || undefined,
            paymentProvider: "Square",
            subscriptionId: validatedInput.subscriptionId,
            productId: subscription.product_id,
            paymentType: "renewal",
            environment: paymentEnvironment, // Include environment in event
            lineItems: lineItems.map((item) => ({
              description: item.item,
              amount: item.price,
            })),
          })
        )
      }

      // Mark purchase request as completed
      await this.deps.purchaseRequestRepository.markAsCompleted(
        purchaseRequestId,
        {
          subscriptionId: validatedInput.subscriptionId,
          transactionId,
          amountCharged: totalAmount,
          cardId,
        },
        startTime
      )

      logger.info("Subscription renewal completed", {
        subscriptionId: validatedInput.subscriptionId,
        amount: totalAmount,
        nextRenewalDate: newRenewalDate,
        duration: new Date().getTime() - startTime.getTime(),
      })

      return success({
        subscriptionId: validatedInput.subscriptionId,
        transactionId: transactionId ? String(transactionId) : "",
        nextRenewalDate: newRenewalDate,
        amount: totalAmount,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Subscription renewal error", {
        error: errorMessage,
        subscriptionId: input.subscriptionId,
        duration: new Date().getTime() - startTime.getTime(),
      })

      // Mark purchase request as failed if it was created
      if (purchaseRequestId) {
        try {
          await this.deps.purchaseRequestRepository.markAsFailed(
            purchaseRequestId,
            errorMessage,
            "RENEWAL_ERROR"
          )
        } catch (updateError) {
          logger.error("Failed to update purchase request status", { updateError })
        }
      }

      // Handle renewal failure (keeps existing retry logic for backward compatibility)
      await this.handleRenewalFailure(input.subscriptionId, input.email, errorMessage)

      return failure(errorMessage, "RENEWAL_ERROR")
    }
  }

  private async processRenewalPayment(
    userId: number,
    email: string,
    amount: number,
    subscriptionName: string,
    lineItems: LineItem[],
    subscriptionId: number
  ): Promise<{ paymentId: string; cardId: string; environment: 'production' | 'sandbox' }> {
    const { logger, paymentProvider, userCardRepository, subscriptionRepository } = this.deps

    // Get user's card
    const userCards = await userCardRepository.findByUserId(userId)
    if (!userCards || userCards.length === 0) {
      throw new Error("No payment card found for user")
    }

    const userCard = userCards[0]
    if (!userCard.card_id || !userCard.square_customer_id) {
      throw new Error("Incomplete card information")
    }

    // CRITICAL: Determine environment from card and/or subscription
    // This ensures sandbox subscriptions renew with sandbox, production with production
    const subscription = await subscriptionRepository.findById(subscriptionId)
    const environment = (userCard.square_environment || subscription?.square_environment || 'production') as 'production' | 'sandbox'

    // Create PaymentContext with testMode based on environment
    const context: import('@/config/config.interface').PaymentContext = {
      testMode: environment === 'sandbox',
      source: 'CRON',
      userId,
      metadata: {
        subscriptionId,
        detectedEnvironment: environment
      }
    }

    logger.info('Processing renewal payment with detected environment', {
      userId,
      subscriptionId,
      environment,
      testMode: context.testMode
    })

    // Create payment with correct environment context
    const payment = await paymentProvider.createPayment({
      sourceId: userCard.card_id,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount: BigInt(amount),
        currency: "USD",
      },
      customerId: userCard.square_customer_id,
      note: `Renewal: ${subscriptionName}`,
    }, context) // Pass context with correct testMode

    if (payment.status !== "COMPLETED") {
      throw new Error("Payment failed")
    }

    logger.info("Renewal payment processed", {
      userId,
      amount,
      paymentId: payment.id,
      environment: payment.environment,
    })

    return {
      paymentId: payment.id,
      cardId: userCard.card_id,
      environment: payment.environment, // Return environment for transaction logging
    }
  }


  private async handleRenewalFailure(
    subscriptionId: number,
    email: string,
    error: string
  ): Promise<void> {
    const { logger, eventBus, subscriptionRepository, transactionRepository } = this.deps

    try {
      // Get subscription for details
      const subscription = await subscriptionRepository.findById(subscriptionId)
      if (!subscription) return

      // Update next renewal attempt with escalating retry logic
      const nextAttempt = this.calculateNextRetryAttempt(subscription.next_renewal_attempt)
      const now = new Date()
      await subscriptionRepository.update(subscriptionId, {
        next_renewal_attempt: nextAttempt,
        updatedAt: now,
      })

      // Log failed transaction (use environment from subscription if available)
      await transactionRepository.create({
        user_id: subscription.user_id!,
        amount: subscription.amount || 0,
        type: "subscription",
        memo: `${subscription.subscription_name || "Subscription"} (failed)`,
        status: "failed",
        square_environment: subscription.square_environment || 'production',
        data: JSON.stringify({ error }),
        createdAt: now,
        updatedAt: now,
      })

      // Publish PaymentFailedEvent (this will trigger email notification)
      await eventBus.publish(
        PaymentFailedEvent.create({
          userId: subscription.user_id!,
          email,
          amount: subscription.amount || 0,
          currency: "USD",
          paymentProvider: "Square",
          subscriptionId,
          productId: subscription.product_id || undefined,
          paymentType: "renewal",
          environment: subscription.square_environment || 'production', // Include environment in event
          errorMessage: error,
          errorCode: "RENEWAL_ERROR",
          willRetry: true,
          nextRetryDate: nextAttempt,
        })
      )

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
