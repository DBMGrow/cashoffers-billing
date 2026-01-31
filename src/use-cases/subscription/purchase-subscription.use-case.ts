import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { IProductRepository } from "@/infrastructure/database/repositories/product.repository.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IPurchaseSubscriptionUseCase } from "./purchase-subscription.use-case.interface"
import { PurchaseSubscriptionInput, PurchaseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { PurchaseSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userApiClient: IUserApiClient
  productRepository: IProductRepository
  subscriptionRepository: ISubscriptionRepository
  userCardRepository: IUserCardRepository
  transactionRepository: ITransactionRepository
}

/**
 * PurchaseSubscriptionUseCase
 *
 * Handles the complete subscription purchase flow:
 * 1. Product validation
 * 2. User lookup or creation
 * 3. Card creation or update
 * 4. Subscription creation with initial payment
 * 5. Email notifications
 *
 * Note: Prorated charge calculation for upgrades is not yet implemented
 */
export class PurchaseSubscriptionUseCase implements IPurchaseSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: PurchaseSubscriptionInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = PurchaseSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Processing purchase", {
        productId: validatedInput.productId,
        email: validatedInput.email,
      })

      // 1. Validate product
      const product = await this.deps.productRepository.findById(
        typeof validatedInput.productId === "number"
          ? validatedInput.productId
          : parseInt(validatedInput.productId as string, 10)
      )

      if (!product) {
        logger.warn("Product not found", { productId: validatedInput.productId })
        return failure("Product not found", "PRODUCT_NOT_FOUND")
      }

      // 2. Look up or create user
      let user = await this.deps.userApiClient.getUserByEmail(validatedInput.email)
      let userCreated = false
      let userId: number

      if (user) {
        // Existing user - validate API token
        if (!validatedInput.apiToken) {
          return failure("API token required for existing user", "API_TOKEN_REQUIRED")
        }

        // Note: API token validation would happen here
        // For now, we'll trust the token (validation should be done by auth middleware)
        userId = user.id

        logger.info("Existing user found", { userId })
      } else {
        // New user - require phone and card
        if (!validatedInput.phone) {
          return failure("Phone required for new user", "PHONE_REQUIRED")
        }
        if (!validatedInput.cardToken) {
          return failure("Card token required for new user", "CARD_TOKEN_REQUIRED")
        }

        // Create card first (with null user_id)
        const cardResult = await this.createCard(null, validatedInput)
        if (!cardResult.success) {
          return failure(cardResult.error || "Card creation failed", "CARD_CREATION_FAILED")
        }

        // Create user in main API
        try {
          user = await this.deps.userApiClient.createUser({
            email: validatedInput.email,
            phone: validatedInput.phone,
          })
          userId = user.id
          userCreated = true

          logger.info("New user created", { userId })

          // Update card with user_id (find by card_id first)
          const cards = await this.deps.userCardRepository.findAll({ card_id: cardResult.cardId })
          if (cards.length > 0) {
            await this.deps.userCardRepository.update(cards[0].id, {
              user_id: userId,
              updatedAt: new Date(),
            })
          }
        } catch (error) {
          logger.error("Failed to create user", { error })
          return failure("Failed to create user", "USER_CREATION_FAILED")
        }
      }

      // 3. Create or update card for existing user
      let cardIdString: string | undefined
      if (user && !userCreated && validatedInput.cardToken) {
        const cardResult = await this.createCard(userId, validatedInput)
        if (!cardResult.success) {
          return failure(cardResult.error || "Card update failed", "CARD_UPDATE_FAILED")
        }
        cardIdString = cardResult.cardId
      } else if (userCreated) {
        // Card was already created for new user
        const userCards = await this.deps.userCardRepository.findByUserId(userId)
        if (userCards.length > 0 && userCards[0].card_id) {
          cardIdString = userCards[0].card_id
        }
      } else {
        // Use existing card
        const userCards = await this.deps.userCardRepository.findByUserId(userId)
        if (userCards.length === 0) {
          return failure("No card found for user", "NO_CARD_FOUND")
        }
        if (!userCards[0].card_id) {
          return failure("Card ID is missing", "CARD_ID_MISSING")
        }
        cardIdString = userCards[0].card_id
      }

      if (!cardIdString) {
        return failure("Failed to get card ID", "CARD_ID_MISSING")
      }

      // 4. Check if user already has a subscription (for upgrade detection)
      const existingSubscriptions = await this.deps.subscriptionRepository.findByUserId(userId)
      const activeSubscription = existingSubscriptions.find(
        (sub) => sub.status === "active" || sub.status === "suspended"
      )

      // TODO: Calculate and charge prorated amount for upgrades
      // This would use the checkProrated logic to calculate the difference
      // For now, we'll just note if it's an upgrade

      // 5. Create subscription with initial payment
      // Parse product data (JSON field)
      const productData = typeof product.data === 'object' && product.data !== null ? product.data as any : {}
      const signupFee = productData.signup_fee || 0
      const renewalCost = productData.renewal_cost || product.price
      const productDuration = productData.duration || "monthly"

      // Calculate initial charge (signup fee + first period)
      const initialAmount = signupFee + renewalCost

      // Get card for payment
      const userCard = await this.deps.userCardRepository.findOne({ card_id: cardIdString })
      if (!userCard) {
        return failure("Card not found", "CARD_NOT_FOUND")
      }

      // Process initial payment
      const payment = await this.deps.paymentProvider.createPayment({
        sourceId: userCard.card_id,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(initialAmount),
          currency: "USD",
        },
        customerId: userCard.square_customer_id || undefined,
      })

      if (payment.status !== "COMPLETED") {
        logger.error("Initial payment failed", { paymentId: payment.id, status: payment.status })
        return failure("Payment failed", "PAYMENT_FAILED")
      }

      // Calculate renewal date
      const renewalDate = this.calculateRenewalDate(productDuration)

      // Create subscription
      const now = new Date()
      const subscription = await this.deps.subscriptionRepository.create({
        user_id: userId,
        subscription_name: product.product_name,
        amount: renewalCost,
        duration: productDuration as "daily" | "weekly" | "monthly" | "yearly",
        status: "active",
        renewal_date: renewalDate,
        product_id: product.product_id,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        createdAt: now,
        updatedAt: now,
      })

      // Log transaction
      await this.deps.transactionRepository.create({
        user_id: userId,
        amount: initialAmount,
        type: "subscription",
        memo: `Subscription created: ${product.product_name}`,
        status: "completed",
        square_transaction_id: payment.id,
        product_id: product.product_id,
        data: JSON.stringify({ signupFee, renewalCost }),
        createdAt: now,
        updatedAt: now,
      })

      // Activate user premium
      await this.deps.userApiClient.activateUserPremium(userId)

      // Send welcome email
      try {
        await this.deps.emailService.sendEmail({
          to: validatedInput.email,
          subject: "Welcome to CashOffers!",
          template: "subscriptionCreated.html",
          fields: {
            subscriptionName: product.product_name,
            amount: `$${(renewalCost / 100).toFixed(2)}`,
            renewalDate: renewalDate.toLocaleDateString(),
          },
        })
      } catch (emailError) {
        // Don't fail purchase if email fails
        logger.warn("Failed to send welcome email", { error: emailError })
      }

      logger.info("Purchase completed successfully", {
        userId,
        subscriptionId: subscription.subscription_id,
        amount: initialAmount,
        duration: Date.now() - startTime,
      })

      return success({
        subscriptionId: subscription.subscription_id,
        userId,
        cardId: cardIdString,
        productId: validatedInput.productId,
        amount: initialAmount,
        proratedCharge: activeSubscription ? undefined : 0,
        userCreated,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Purchase error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "PURCHASE_ERROR")
    }
  }

  private async createCard(
    userId: number | null,
    input: PurchaseSubscriptionInput
  ): Promise<{ success: boolean; cardId?: string; error?: string }> {
    const { logger, paymentProvider, userCardRepository, emailService } = this.deps

    try {
      if (!input.cardToken || !input.expMonth || !input.expYear || !input.cardholderName) {
        return { success: false, error: "Card information incomplete" }
      }

      // Create card in Square
      const card = await paymentProvider.createCard({
        sourceId: input.cardToken,
        card: {
          cardholderName: input.cardholderName,
        },
      })

      // Save card to database (we'll use a placeholder for square_customer_id since it's not in CardResult)
      const now = new Date()
      const userCard = await userCardRepository.create({
        user_id: userId,
        card_id: card.id,
        square_customer_id: card.id, // Use card id as customer id placeholder
        card_brand: card.cardBrand,
        last_4: card.last4,
        exp_month: input.expMonth.toString(),
        exp_year: input.expYear.toString(),
        cardholder_name: input.cardholderName,
        createdAt: now,
        updatedAt: now,
      })

      // Send email notification if updating existing user's card
      if (userId && input.email) {
        try {
          await emailService.sendEmail({
            to: input.email,
            subject: "Card Updated",
            template: "cardUpdated.html",
            fields: {
              last4: card.last4 || "****",
              cardBrand: card.cardBrand || "Card",
            },
          })
        } catch (emailError) {
          logger.warn("Failed to send card update email", { error: emailError })
        }
      }

      return { success: true, cardId: userCard.card_id }
    } catch (error) {
      logger.error("Card creation failed", { error, userId })
      return { success: false, error: error instanceof Error ? error.message : "Card creation failed" }
    }
  }

  private calculateRenewalDate(duration: string): Date {
    const now = new Date()
    const renewalDate = new Date(now)

    switch (duration) {
      case "daily":
        renewalDate.setDate(renewalDate.getDate() + 1)
        break
      case "weekly":
        renewalDate.setDate(renewalDate.getDate() + 7)
        break
      case "monthly":
        renewalDate.setMonth(renewalDate.getMonth() + 1)
        break
      case "yearly":
        renewalDate.setFullYear(renewalDate.getFullYear() + 1)
        break
      default:
        renewalDate.setMonth(renewalDate.getMonth() + 1) // Default to monthly
    }

    return renewalDate
  }
}
