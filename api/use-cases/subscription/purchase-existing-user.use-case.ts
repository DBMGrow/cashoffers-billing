import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import type { ProductRepository } from "@api/lib/repositories"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { UserCardRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { PurchaseRequestRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IPurchaseExistingUserUseCase } from "./purchase-existing-user.use-case.interface"
import { ExistingUserPurchaseInput, PurchaseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { ExistingUserPurchaseInputSchema } from "../types/validation.schemas"
import { ProductData } from "@api/domain/types/product-data.types"
import { v4 as uuidv4 } from "uuid"
import { PaymentProcessedEvent } from "@api/domain/events/payment-processed.event"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"
import { PurchaseRequestCompletedEvent } from "@api/domain/events/purchase-request-completed.event"
import { createCardHelper, calculateRenewalDate } from "./purchase-helpers"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  productRepository: ProductRepository
  subscriptionRepository: SubscriptionRepository
  userCardRepository: UserCardRepository
  transactionRepository: TransactionRepository
  purchaseRequestRepository: PurchaseRequestRepository
  eventBus: IEventBus
}

/**
 * PurchaseExistingUserUseCase
 *
 * Handles the subscription purchase flow for an already-authenticated user:
 * 1. Product validation
 * 2. Card resolution (new card from token, or existing card on file)
 * 3. Initial payment processing
 * 4. Subscription creation
 * 5. Event publishing (CardCreated if new card, SubscriptionCreated, PaymentProcessed)
 */
export class PurchaseExistingUserUseCase implements IPurchaseExistingUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ExistingUserPurchaseInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = new Date()
    let purchaseRequestId: number | null = null

    try {
      // Validate input
      const validationResult = ExistingUserPurchaseInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Existing user purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const v = validationResult.data
      const productIdNum = typeof v.productId === "number" ? v.productId : parseInt(v.productId as string, 10)

      // 0. Create PurchaseRequest for tracking (status: PENDING)
      const purchaseRequest = await this.deps.purchaseRequestRepository.create({
        request_uuid: uuidv4(),
        request_type: "NEW_PURCHASE",
        source: "API",
        user_id: v.userId,
        email: v.email,
        product_id: productIdNum,
        subscription_id: null,
        request_data: JSON.stringify(v),
        status: "PENDING",
        idempotency_key: null,
      })
      purchaseRequestId = purchaseRequest.request_id

      logger.info("Processing existing user purchase", {
        purchaseRequestId,
        userId: v.userId,
        productId: v.productId,
      })

      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "VALIDATING")

      // 1. Validate product
      const product = await this.deps.productRepository.findById(productIdNum)
      if (!product) {
        logger.warn("Product not found", { productId: v.productId })
        await this.deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, "Product not found", "PRODUCT_NOT_FOUND")
        return failure("Product not found", "PRODUCT_NOT_FOUND")
      }

      const productData = typeof product.data === "object" && product.data !== null ? (product.data as ProductData) : {}
      const userConfig = productData.user_config

      // 2. Resolve card: create a new one if a token was provided, otherwise use card on file
      let cardIdString: string

      if (v.cardToken && v.expMonth && v.expYear && v.cardholderName) {
        const cardResult = await createCardHelper(
          {
            logger: this.deps.logger,
            paymentProvider: this.deps.paymentProvider,
            userCardRepository: this.deps.userCardRepository,
            eventBus: this.deps.eventBus,
          },
          v.userId,
          {
            email: v.email,
            cardToken: v.cardToken,
            expMonth: v.expMonth,
            expYear: v.expYear,
            cardholderName: v.cardholderName,
            context: input.context,
          }
        )

        if (!cardResult.success) {
          return failure(cardResult.error || "Card update failed", "CARD_UPDATE_FAILED")
        }
        cardIdString = cardResult.cardId!
      } else {
        // Use card on file
        const userCards = await this.deps.userCardRepository.findByUserId(v.userId)
        if (userCards.length === 0) {
          return failure("No card found for user", "NO_CARD_FOUND")
        }
        if (!userCards[0].card_id) {
          return failure("Card ID is missing", "CARD_ID_MISSING")
        }
        cardIdString = userCards[0].card_id
      }

      // 3. Check if user already has a subscription (for upgrade detection)
      const existingSubscriptions = await this.deps.subscriptionRepository.findByUserId(v.userId)
      const activeSubscription = existingSubscriptions.find(
        (sub) => sub.status === "active" || sub.status === "suspended"
      )

      // 4. Get card for payment
      const userCard = await this.deps.userCardRepository.findOne({ card_id: cardIdString })
      if (!userCard) {
        await this.deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, "Card not found", "CARD_NOT_FOUND")
        return failure("Card not found", "CARD_NOT_FOUND")
      }

      // 5. Process initial payment
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")

      const signupFee = productData.signup_fee || 0
      const renewalCost = productData.renewal_cost || product.price
      const productDuration = productData.duration || "monthly"
      const initialAmount = signupFee + renewalCost

      const payment = input.context?.mockPurchase
        ? {
            id: `MOCK_PAYMENT_${Date.now()}`,
            status: "COMPLETED" as const,
            environment: "sandbox" as const,
            amountMoney: {
              amount: BigInt(initialAmount),
              currency: "USD" as const,
            },
          }
        : await this.deps.paymentProvider.createPayment(
            {
              sourceId: userCard.card_id,
              idempotencyKey: uuidv4(),
              amountMoney: {
                amount: BigInt(initialAmount),
                currency: "USD",
              },
              customerId: userCard.square_customer_id || undefined,
            },
            input.context
          )

      if (payment.status !== "COMPLETED") {
        logger.error("Initial payment failed", { paymentId: payment.id, status: payment.status })
        await this.deps.purchaseRequestRepository.markAsFailed(
          purchaseRequestId,
          `Payment failed: ${payment.status}`,
          "PAYMENT_FAILED"
        )
        return failure("Payment failed", "PAYMENT_FAILED")
      }

      // 6. Create subscription
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")

      const renewalDate = calculateRenewalDate(productDuration)
      const now = new Date()
      const subscription = await this.deps.subscriptionRepository.create({
        user_id: v.userId,
        subscription_name: product.product_name,
        amount: renewalCost,
        duration: productDuration as "daily" | "weekly" | "monthly" | "yearly",
        status: "active",
        renewal_date: renewalDate,
        product_id: product.product_id,
        square_environment: payment.environment,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        data: userConfig ? JSON.stringify({ user_config: userConfig }) : null,
        createdAt: now,
        updatedAt: now,
      })

      // 7. Log transaction
      const transaction = await this.deps.transactionRepository.create({
        user_id: v.userId,
        amount: initialAmount,
        type: "subscription",
        memo: `Subscription created: ${product.product_name}`,
        status: "completed",
        square_transaction_id: payment.id,
        square_environment: payment.environment,
        product_id: product.product_id,
        data: JSON.stringify({ signupFee, renewalCost }),
        createdAt: now,
        updatedAt: now,
      })

      // 8. Finalize and publish events
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")

      await this.deps.eventBus.publish(
        SubscriptionCreatedEvent.create({
          subscriptionId: subscription.subscription_id,
          userId: v.userId,
          email: v.email,
          productId: product.product_id,
          productName: product.product_name,
          amount: renewalCost,
          initialChargeAmount: initialAmount,
          transactionId: transaction.transaction_id,
          cardId: cardIdString,
          userWasCreated: false,
          nextRenewalDate: renewalDate,
          environment: payment.environment,
          source: "API",
        })
      )

      await this.deps.eventBus.publish(
        PaymentProcessedEvent.create({
          transactionId: transaction.transaction_id,
          externalTransactionId: payment.id,
          userId: v.userId,
          email: v.email,
          amount: initialAmount,
          currency: "USD",
          cardId: cardIdString,
          cardLast4: userCard.last_4,
          paymentProvider: "Square",
          subscriptionId: subscription.subscription_id,
          productId: product.product_id,
          paymentType: "subscription",
          environment: payment.environment,
          lineItems: [
            { description: "Signup fee", amount: signupFee },
            { description: "First period", amount: renewalCost },
          ],
        })
      )

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

      await this.deps.eventBus.publish(
        PurchaseRequestCompletedEvent.create({
          purchaseRequestId,
          requestUuid: purchaseRequest.request_uuid,
          requestType: "NEW_PURCHASE",
          source: "API",
          userId: v.userId,
          email: v.email,
          productId: product.product_id,
          subscriptionId: subscription.subscription_id,
          transactionId: transaction.transaction_id,
          amountCharged: initialAmount,
          cardId: cardIdString,
          userWasCreated: false,
          processingDuration: new Date().getTime() - startTime.getTime(),
        })
      )

      logger.info("Existing user purchase completed successfully", {
        userId: v.userId,
        subscriptionId: subscription.subscription_id,
        amount: initialAmount,
        duration: new Date().getTime() - startTime.getTime(),
      })

      return success({
        subscriptionId: subscription.subscription_id,
        userId: v.userId,
        cardId: cardIdString,
        productId: v.productId,
        amount: initialAmount,
        proratedCharge: activeSubscription ? undefined : 0,
        userCreated: false,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Existing user purchase error", {
        error: errorMessage,
        duration: new Date().getTime() - startTime.getTime(),
      })

      if (purchaseRequestId) {
        try {
          await this.deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, errorMessage, "PURCHASE_ERROR")
        } catch (updateError) {
          logger.error("Failed to update purchase request status", { updateError })
        }
      }

      return failure(errorMessage, "PURCHASE_ERROR")
    }
  }
}
