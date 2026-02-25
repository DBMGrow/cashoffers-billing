import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { ProductRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { UserCardRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { ICreateSubscriptionUseCase } from "./create-subscription.use-case.interface"
import { CreateSubscriptionInput, CreateSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CreateSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"
import { PaymentProcessedEvent } from "@api/domain/events/payment-processed.event"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userApiClient: IUserApiClient
  subscriptionRepository: SubscriptionRepository
  productRepository: ProductRepository
  transactionRepository: TransactionRepository
  userCardRepository: UserCardRepository
  eventBus: IEventBus
}

/**
 * CreateSubscriptionUseCase
 *
 * Handles new subscription creation with:
 * - Product validation
 * - User activation via external API
 * - Subscription record creation
 * - Initial payment processing
 * - Transaction logging
 * - Email notifications
 */
export class CreateSubscriptionUseCase implements ICreateSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CreateSubscriptionInput): Promise<UseCaseResult<CreateSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = CreateSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Subscription validation failed", { errors, input })
        return failure(errors, "SUBSCRIPTION_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Creating subscription", {
        userId: validatedInput.userId,
        productId: validatedInput.productId,
      })

      // Validate product - convert productId to number if it's a numeric string, otherwise keep as-is
      let productId: number | string = validatedInput.productId
      if (typeof validatedInput.productId === "string") {
        const parsed = parseInt(validatedInput.productId, 10)
        if (!isNaN(parsed)) {
          productId = parsed
        }
      }

      const product = await this.deps.productRepository.findById(productId as any)
      if (!product) {
        logger.warn("Product not found", { productId: validatedInput.productId })
        return failure("Product not found", "PRODUCT_NOT_FOUND")
      }

      // Parse product data (stored as JSON string in database)
      const productData = this.parseProductData(product.data)
      if (!productData.duration) {
        logger.error("Product missing duration", { productId: validatedInput.productId })
        return failure("Product configuration invalid: missing duration", "INVALID_PRODUCT_CONFIG")
      }

      // Create subscription record
      const now = new Date()
      const renewalDate = this.calculateRenewalDate(productData.duration)

      const subscription = await this.deps.subscriptionRepository.create({
        user_id: validatedInput.userId,
        subscription_name: product.product_name,
        product_id: typeof productId === "number" ? productId : parseInt(String(productId), 10),
        amount: productData.renewal_cost ?? 0,
        duration: productData.duration,
        renewal_date: renewalDate,
        status: "active",
        data: typeof product.data === "string" ? product.data : JSON.stringify(product.data),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Subscription created", {
        subscriptionId: subscription.subscription_id,
        userId: validatedInput.userId,
        amount: productData.renewal_cost,
      })

      // Process initial payment
      const signupFee =
        validatedInput.userAlreadyExists || validatedInput.waiveSignupFee ? 0 : product.price
      const totalAmount = (productData.renewal_cost ?? 0) + signupFee

      let paymentId: string | undefined
      let cardId: string | undefined
      let transactionId: number | undefined

      if (totalAmount > 0) {
        const paymentResult = await this.processInitialPayment(
          validatedInput.userId,
          validatedInput.email,
          totalAmount,
          product.product_name,
          signupFee
        )
        paymentId = paymentResult.paymentId
        cardId = paymentResult.cardId
        transactionId = paymentResult.transactionId
      }

      // Log subscription creation transaction
      await this.deps.transactionRepository.create({
        user_id: validatedInput.userId,
        type: "subscription",
        memo: "Subscription created",
        status: "completed",
        data: this.serializeProduct(product),
        createdAt: now,
        updatedAt: now,
      })

      // Publish domain events (this will trigger email, premium activation, etc.)
      await this.deps.eventBus.publish(
        SubscriptionCreatedEvent.create({
          subscriptionId: subscription.subscription_id,
          userId: validatedInput.userId,
          email: validatedInput.email,
          productId: typeof productId === "number" ? productId : parseInt(String(productId), 10),
          productName: product.product_name,
          amount: productData.renewal_cost ?? 0,
          initialChargeAmount: totalAmount,
          transactionId,
          cardId,
          nextRenewalDate: renewalDate,
          source: "API",
        })
      )

      // Publish payment processed event if payment was made
      if (paymentId && totalAmount > 0) {
        await this.deps.eventBus.publish(
          PaymentProcessedEvent.create({
            transactionId: transactionId!,
            externalTransactionId: paymentId,
            userId: validatedInput.userId,
            email: validatedInput.email,
            amount: totalAmount,
            currency: "USD",
            cardId,
            paymentProvider: "Square",
            subscriptionId: subscription.subscription_id,
            productId: typeof productId === "number" ? productId : parseInt(String(productId), 10),
            paymentType: "subscription",
            lineItems: [
              ...(signupFee > 0 ? [{ description: "Signup fee", amount: signupFee }] : []),
              { description: "First period", amount: productData.renewal_cost ?? 0 },
            ],
          })
        )
      }

      logger.info("Subscription creation completed", {
        subscriptionId: subscription.subscription_id,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: subscription.subscription_id,
        status: subscription.status || "active",
        renewalDate,
        amount: productData.renewal_cost ?? 0,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Subscription creation error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "SUBSCRIPTION_ERROR")
    }
  }

  private parseProductData(dataString: any): any {
    if (!dataString) return {}
    if (typeof dataString === "object") return dataString
    try {
      return JSON.parse(String(dataString))
    } catch {
      return {}
    }
  }

  private calculateRenewalDate(duration: string): Date {
    const now = new Date()
    const durationLower = duration.toLowerCase()

    if (durationLower === "monthly" || durationLower === "month") {
      return new Date(now.setMonth(now.getMonth() + 1))
    } else if (durationLower === "yearly" || durationLower === "year") {
      return new Date(now.setFullYear(now.getFullYear() + 1))
    } else if (durationLower === "weekly" || durationLower === "week") {
      return new Date(now.setDate(now.getDate() + 7))
    }

    // Default to monthly
    return new Date(now.setMonth(now.getMonth() + 1))
  }

  private async processInitialPayment(
    userId: number,
    email: string,
    totalAmount: number,
    subscriptionName: string,
    signupFee: number
  ): Promise<{ paymentId: string; cardId: string; transactionId: number }> {
    const { logger, paymentProvider, userCardRepository, transactionRepository } = this.deps

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
        amount: BigInt(totalAmount),
        currency: "USD",
      },
      customerId: userCard.square_customer_id,
      note: `Initial charge for ${subscriptionName}`,
    })

    if (payment.status !== "COMPLETED") {
      throw new Error("Initial payment failed")
    }

    // Log payment transaction
    const now = new Date()
    const transaction = await transactionRepository.create({
      user_id: userId,
      amount: totalAmount,
      type: "payment",
      memo: `Initial charge: ${subscriptionName}${signupFee > 0 ? " + Signup Fee" : ""}`,
      status: "completed",
      square_transaction_id: payment.id,
      data: this.serializePayment(payment),
      createdAt: now,
      updatedAt: now,
    })

    logger.info("Initial payment processed", {
      userId,
      amount: totalAmount,
      paymentId: payment.id,
    })

    return {
      paymentId: payment.id,
      cardId: userCard.card_id,
      transactionId: transaction.transaction_id,
    }
  }

  private serializeProduct(product: any): string {
    return JSON.stringify(product, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  }

  private serializePayment(payment: any): string {
    return JSON.stringify(payment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  }
}
