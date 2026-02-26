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
import { ExistingUserPurchaseInputSchema, ExistingUserPurchaseInputValidated } from "../types/validation.schemas"
import type { PaymentContext } from "@api/config/config.interface"
import {
  PurchaseError,
  parseProductId,
  calculatePricing,
  createPurchaseRequest,
  validateAndParseProduct,
  resolveCardRecord,
  processInitialPayment,
  createSubscriptionRecord,
  createTransactionRecord,
  publishPurchaseEvents,
  createCardHelper,
} from "./purchase-helpers"

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
      // Validate input (before tracking — early return, no markAsFailed needed)
      const validationResult = ExistingUserPurchaseInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((i) => i.message).join(", ")
        logger.error("Existing user purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const v = validationResult.data
      const productIdNum = parseProductId(v.productId)

      // Track the request
      const purchaseRequest = await createPurchaseRequest(this.deps, {
        productIdNum,
        email: v.email,
        userId: v.userId,
        input: v,
      })
      purchaseRequestId = purchaseRequest.request_id

      logger.info("Processing existing user purchase", { purchaseRequestId, userId: v.userId, productId: v.productId })
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "VALIDATING")

      // Validate product
      const { product, productData, userConfig } = await validateAndParseProduct(
        this.deps,
        productIdNum,
        purchaseRequestId
      )

      // Resolve card (new token or card on file)
      const cardIdString = await this.resolveCard(v, input.context)

      // Check for existing active subscription (for upgrade detection)
      const activeSubscription = await this.findActiveSubscription(v.userId)

      // Resolve card row for payment
      const userCard = await resolveCardRecord(this.deps, cardIdString, purchaseRequestId)

      // Process payment
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")
      const pricing = calculatePricing(product, productData)
      const payment = await processInitialPayment(this.deps, userCard, pricing, input.context, purchaseRequestId)

      // Create subscription
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")
      const subscription = await createSubscriptionRecord(this.deps, {
        userId: v.userId,
        product,
        pricing,
        payment,
        userConfig,
      })

      // Log transaction
      const transaction = await createTransactionRecord(this.deps, {
        userId: v.userId,
        product,
        pricing,
        payment,
      })

      // Publish events and finalize
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")
      await publishPurchaseEvents(this.deps, {
        purchaseRequestId,
        purchaseRequestUuid: purchaseRequest.request_uuid,
        userId: v.userId,
        email: v.email,
        product,
        subscription,
        transaction,
        pricing,
        payment,
        cardIdString,
        userCard,
        userWasCreated: false,
        startTime,
      })

      logger.info("Existing user purchase completed successfully", {
        userId: v.userId,
        subscriptionId: subscription.subscription_id,
        amount: pricing.initialAmount,
        duration: new Date().getTime() - startTime.getTime(),
      })

      return success({
        subscriptionId: subscription.subscription_id,
        userId: v.userId,
        cardId: cardIdString,
        productId: v.productId,
        amount: pricing.initialAmount,
        proratedCharge: activeSubscription ? undefined : 0,
        userCreated: false,
      })
    } catch (error) {
      return this.handleError(error, purchaseRequestId, startTime)
    }
  }

  private async resolveCard(
    v: ExistingUserPurchaseInputValidated,
    context: PaymentContext | null | undefined
  ): Promise<string> {
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
          context,
        }
      )

      if (!cardResult.success) {
        throw new PurchaseError(cardResult.error || "Card update failed", "CARD_UPDATE_FAILED")
      }
      return cardResult.cardId!
    }

    // Use card on file
    const userCards = await this.deps.userCardRepository.findByUserId(v.userId)
    if (userCards.length === 0) {
      throw new PurchaseError("No card found for user", "NO_CARD_FOUND")
    }
    if (!userCards[0].card_id) {
      throw new PurchaseError("Card ID is missing", "CARD_ID_MISSING")
    }
    return userCards[0].card_id
  }

  private async findActiveSubscription(userId: number) {
    const subscriptions = await this.deps.subscriptionRepository.findByUserId(userId)
    return subscriptions.find((sub) => sub.status === "active" || sub.status === "suspended")
  }

  private async handleError(
    error: unknown,
    purchaseRequestId: number | null,
    startTime: Date
  ): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorCode = error instanceof PurchaseError ? error.code : "PURCHASE_ERROR"

    this.deps.logger.error("Existing user purchase error", {
      error: errorMessage,
      duration: new Date().getTime() - startTime.getTime(),
    })

    // PurchaseErrors already handled markAsFailed (or intentionally skipped it)
    if (purchaseRequestId && !(error instanceof PurchaseError)) {
      try {
        await this.deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, errorMessage, errorCode)
      } catch (updateError) {
        this.deps.logger.error("Failed to update purchase request status", { updateError })
      }
    }

    return failure(errorMessage, errorCode)
  }
}
