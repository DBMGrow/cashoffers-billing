import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { IProductRepository } from "@/infrastructure/database/repositories/product.repository.interface"
import { ISubscriptionRepository } from "@/infrastructure/database/repositories/subscription.repository.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IPurchaseRequestRepository } from "@/infrastructure/database/repositories/purchase-request.repository.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { IPurchaseSubscriptionUseCase } from "./purchase-subscription.use-case.interface"
import { PurchaseSubscriptionInput, PurchaseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { PurchaseSubscriptionInputSchema } from "../types/validation.schemas"
import { ProductData } from "@/domain/types/product-data.types"
import { v4 as uuidv4 } from "uuid"
import { UserCreatedEvent } from "@/domain/events/user-created.event"
import { CardCreatedEvent } from "@/domain/events/card-created.event"
import { PaymentProcessedEvent } from "@/domain/events/payment-processed.event"
import { SubscriptionCreatedEvent } from "@/domain/events/subscription-created.event"
import { PurchaseRequestCompletedEvent } from "@/domain/events/purchase-request-completed.event"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userApiClient: IUserApiClient
  productRepository: IProductRepository
  subscriptionRepository: ISubscriptionRepository
  userCardRepository: IUserCardRepository
  transactionRepository: ITransactionRepository
  purchaseRequestRepository: IPurchaseRequestRepository
  eventBus: IEventBus
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
    const startTime = new Date()
    let purchaseRequestId: number | null = null

    try {
      // Validate input
      const validationResult = PurchaseSubscriptionInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data

      // 0. Create PurchaseRequest for tracking (status: PENDING)
      const purchaseRequest = await this.deps.purchaseRequestRepository.create({
        request_uuid: uuidv4(),
        request_type: "NEW_PURCHASE",
        source: "API",
        user_id: null, // Will be updated once user is known
        email: validatedInput.email,
        product_id: typeof validatedInput.productId === "number"
          ? validatedInput.productId
          : parseInt(validatedInput.productId as string, 10),
        subscription_id: null,
        request_data: JSON.stringify(validatedInput),
        status: "PENDING",
        idempotency_key: null,
      })
      purchaseRequestId = purchaseRequest.request_id

      logger.info("Processing purchase", {
        purchaseRequestId,
        productId: validatedInput.productId,
        email: validatedInput.email,
      })

      // Update status to VALIDATING
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "VALIDATING")

      // 1. Validate product
      const product = await this.deps.productRepository.findById(
        typeof validatedInput.productId === "number"
          ? validatedInput.productId
          : parseInt(validatedInput.productId as string, 10)
      )

      if (!product) {
        logger.warn("Product not found", { productId: validatedInput.productId })
        await this.deps.purchaseRequestRepository.markAsFailed(
          purchaseRequestId,
          "Product not found",
          "PRODUCT_NOT_FOUND"
        )
        return failure("Product not found", "PRODUCT_NOT_FOUND")
      }

      // Extract user configuration from product data
      const productData = typeof product.data === 'object' && product.data !== null ? product.data as ProductData : {}
      const userConfig = productData.user_config

      // 2. Look up or create user
      let user = await this.deps.userApiClient.getUserByEmail(validatedInput.email)
      let userCreated = false
      let userId: number

      if (user) {
        // Existing user - validate API token
        if (!validatedInput.apiToken) {
          await this.deps.purchaseRequestRepository.markAsFailed(
            purchaseRequestId,
            "API token required for existing user",
            "API_TOKEN_REQUIRED"
          )
          return failure("API token required for existing user", "API_TOKEN_REQUIRED")
        }

        // Note: API token validation would happen here
        // For now, we'll trust the token (validation should be done by auth middleware)
        userId = user.id

        logger.info("Existing user found", { userId })

        // Update purchase request with user_id
        await this.deps.purchaseRequestRepository.update(purchaseRequestId, {
          user_id: userId,
        })
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
            // Apply product user configuration
            is_premium: userConfig?.is_premium,
            role: userConfig?.role,
            whitelabel_id: userConfig?.white_label_id,
          })
          userId = user.id
          userCreated = true

          logger.info("New user created", { userId })

          // Update purchase request with user_id and mark user as created
          await this.deps.purchaseRequestRepository.update(purchaseRequestId, {
            user_id: userId,
            user_created: 1,
          })

          // Update card with user_id (find by card_id first)
          const cards = await this.deps.userCardRepository.findAll({ card_id: cardResult.cardId })
          if (cards.length > 0) {
            await this.deps.userCardRepository.update(cards[0].id, {
              user_id: userId,
              updatedAt: new Date(),
            })
          }

          // Publish UserCreatedEvent
          await this.deps.eventBus.publish(
            UserCreatedEvent.create({
              userId,
              email: validatedInput.email,
              creationSource: "purchase_flow",
              productId: product.product_id,
            })
          )
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
      // Parse product data (already extracted earlier)
      const signupFee = productData.signup_fee || 0
      const renewalCost = productData.renewal_cost || product.price
      const productDuration = productData.duration || "monthly"

      // Calculate initial charge (signup fee + first period)
      const initialAmount = signupFee + renewalCost

      // Get card for payment
      const userCard = await this.deps.userCardRepository.findOne({ card_id: cardIdString })
      if (!userCard) {
        await this.deps.purchaseRequestRepository.markAsFailed(
          purchaseRequestId,
          "Card not found",
          "CARD_NOT_FOUND"
        )
        return failure("Card not found", "CARD_NOT_FOUND")
      }

      // Update status to PROCESSING_PAYMENT
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")

      // Process initial payment
      const payment = await this.deps.paymentProvider.createPayment({
        sourceId: userCard.card_id,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(initialAmount),
          currency: "USD",
        },
        customerId: userCard.square_customer_id || undefined,
      }, input.context) // Pass context for environment selection (use input, not validatedInput)

      if (payment.status !== "COMPLETED") {
        logger.error("Initial payment failed", { paymentId: payment.id, status: payment.status })
        await this.deps.purchaseRequestRepository.markAsFailed(
          purchaseRequestId,
          `Payment failed: ${payment.status}`,
          "PAYMENT_FAILED"
        )
        return failure("Payment failed", "PAYMENT_FAILED")
      }

      // Update status to CREATING_SUBSCRIPTION
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")

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
        square_environment: payment.environment, // Store environment from initial payment
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        data: userConfig ? JSON.stringify({ user_config: userConfig }) : null, // Store user config from product
        createdAt: now,
        updatedAt: now,
      })

      // Log transaction
      const transaction = await this.deps.transactionRepository.create({
        user_id: userId,
        amount: initialAmount,
        type: "subscription",
        memo: `Subscription created: ${product.product_name}`,
        status: "completed",
        square_transaction_id: payment.id,
        square_environment: payment.environment, // Track which Square environment was used
        product_id: product.product_id,
        data: JSON.stringify({ signupFee, renewalCost }),
        createdAt: now,
        updatedAt: now,
      })

      // Update status to FINALIZING
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")

      // Publish domain events (these will trigger email, premium activation, etc.)
      await this.deps.eventBus.publish(
        SubscriptionCreatedEvent.create({
          subscriptionId: subscription.subscription_id,
          userId,
          email: validatedInput.email,
          productId: product.product_id,
          productName: product.product_name,
          amount: renewalCost,
          initialChargeAmount: initialAmount,
          transactionId: transaction.transaction_id,
          cardId: cardIdString,
          userWasCreated: userCreated,
          nextRenewalDate: renewalDate,
          environment: payment.environment, // Include environment in event
          source: "API",
        })
      )

      // Publish payment processed event
      await this.deps.eventBus.publish(
        PaymentProcessedEvent.create({
          transactionId: transaction.transaction_id,
          externalTransactionId: payment.id,
          userId,
          email: validatedInput.email,
          amount: initialAmount,
          currency: "USD",
          cardId: cardIdString,
          cardLast4: userCard.last_4,
          paymentProvider: "Square",
          subscriptionId: subscription.subscription_id,
          productId: product.product_id,
          paymentType: "subscription",
          environment: payment.environment, // Include environment in event
          lineItems: [
            { description: "Signup fee", amount: signupFee },
            { description: "First period", amount: renewalCost },
          ],
        })
      )

      // Mark purchase request as completed
      await this.deps.purchaseRequestRepository.markAsCompleted(
        purchaseRequestId,
        {
          subscriptionId: subscription.subscription_id,
          transactionId: transaction.transaction_id,
          amountCharged: initialAmount,
          cardId: cardIdString,
        },
        startTime
      )

      // Publish PurchaseRequestCompletedEvent
      await this.deps.eventBus.publish(
        PurchaseRequestCompletedEvent.create({
          purchaseRequestId,
          requestUuid: purchaseRequest.request_uuid,
          requestType: "NEW_PURCHASE",
          source: "API",
          userId,
          email: validatedInput.email,
          productId: product.product_id,
          subscriptionId: subscription.subscription_id,
          transactionId: transaction.transaction_id,
          amountCharged: initialAmount,
          cardId: cardIdString,
          userWasCreated: userCreated,
          processingDuration: new Date().getTime() - startTime.getTime(),
        })
      )

      logger.info("Purchase completed successfully", {
        userId,
        subscriptionId: subscription.subscription_id,
        amount: initialAmount,
        duration: new Date().getTime() - startTime.getTime(),
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
        duration: new Date().getTime() - startTime.getTime(),
      })

      // Mark purchase request as failed if it was created
      if (purchaseRequestId) {
        try {
          await this.deps.purchaseRequestRepository.markAsFailed(
            purchaseRequestId,
            errorMessage,
            "PURCHASE_ERROR"
          )
        } catch (updateError) {
          logger.error("Failed to update purchase request status", { updateError })
        }
      }

      return failure(errorMessage, "PURCHASE_ERROR")
    }
  }

  private async createCard(
    userId: number | null,
    input: PurchaseSubscriptionInput
  ): Promise<{ success: boolean; cardId?: string; error?: string }> {
    const { logger, paymentProvider, userCardRepository, eventBus } = this.deps

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
      }, input.context) // Pass context for environment selection

      // Save card to database (we'll use a placeholder for square_customer_id since it's not in CardResult)
      const now = new Date()
      const userCard = await userCardRepository.create({
        user_id: userId,
        card_id: card.id,
        square_customer_id: card.id, // Use card id as customer id placeholder
        square_environment: card.environment, // Track which Square environment was used
        card_brand: card.cardBrand,
        last_4: card.last4,
        exp_month: input.expMonth.toString(),
        exp_year: input.expYear.toString(),
        cardholder_name: input.cardholderName,
        createdAt: now,
        updatedAt: now,
      })

      // Publish CardCreatedEvent
      await eventBus.publish(
        CardCreatedEvent.create({
          cardId: userCard.card_id,
          userId: userId || 0, // Will be updated later if null
          email: input.email,
          cardLast4: card.last4 || "****",
          cardBrand: card.cardBrand,
          expirationMonth: input.expMonth,
          expirationYear: input.expYear,
          externalCardId: card.id,
          paymentProvider: "Square",
          environment: card.environment, // Include environment in event
          isDefault: true,
        })
      )

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
