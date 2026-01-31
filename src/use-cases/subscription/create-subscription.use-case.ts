import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IProductRepository } from "@/infrastructure/database/repositories/product.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { ICreateSubscriptionUseCase } from "./create-subscription.use-case.interface"
import { CreateSubscriptionInput, CreateSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CreateSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userApiClient: IUserApiClient
  subscriptionRepository: ISubscriptionRepository
  productRepository: IProductRepository
  transactionRepository: ITransactionRepository
  userCardRepository: IUserCardRepository
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

      // Determine if this is a premium subscription
      const isPremium = product.product_name !== "KW Subscribe"

      // Activate user via external API
      try {
        await this.deps.userApiClient.updateUser(validatedInput.userId, {
          active: true,
          is_premium: isPremium,
        })
        logger.info("User activated", { userId: validatedInput.userId, isPremium })
      } catch (error) {
        logger.error("Failed to activate user", { error, userId: validatedInput.userId })
        return failure("Failed to activate user", "USER_ACTIVATION_FAILED")
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

      if (totalAmount > 0) {
        await this.processInitialPayment(
          validatedInput.userId,
          validatedInput.email,
          totalAmount,
          product.product_name,
          signupFee
        )
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

      // Send creation email
      await this.sendCreationEmail(
        validatedInput.email,
        product.product_name,
        totalAmount,
        signupFee
      )

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
  ): Promise<void> {
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
    await transactionRepository.create({
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
  }

  private async sendCreationEmail(
    email: string,
    subscriptionName: string,
    totalAmount: number,
    signupFee: number
  ): Promise<void> {
    const lineItems: string[] = []

    if (signupFee > 0) {
      lineItems.push(`Signup Fee: $${(signupFee / 100).toFixed(2)}`)
    }

    lineItems.push(`${subscriptionName}: $${((totalAmount - signupFee) / 100).toFixed(2)}`)

    const lineItemsHtml = lineItems.map((item) => `<li>${item}</li>`).join("")

    await this.deps.emailService.sendEmail({
      to: email,
      subject: "Subscription Created",
      template: "subscriptionCreated.html",
      fields: {
        amount: `$${(totalAmount / 100).toFixed(2)}`,
        date: new Date().toLocaleDateString(),
        subscription: subscriptionName,
        lineItems: lineItemsHtml,
      },
    })
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
