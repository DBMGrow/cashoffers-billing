import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { ProductRepository } from "@api/lib/repositories"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { UserCardRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { PurchaseRequestRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IPurchaseNewUserUseCase } from "./purchase-new-user.use-case.interface"
import { NewUserPurchaseInput, PurchaseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { NewUserPurchaseInputSchema, NewUserPurchaseInputValidated } from "../types/validation.schemas"
import { ProductUserConfig } from "@api/domain/types/product-data.types"
import type { PaymentContext } from "@api/config/config.interface"
import { UserCreatedEvent } from "@api/domain/events/user-created.event"
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
  emailService: IEmailService
  userApiClient: IUserApiClient
  productRepository: ProductRepository
  subscriptionRepository: SubscriptionRepository
  userCardRepository: UserCardRepository
  transactionRepository: TransactionRepository
  purchaseRequestRepository: PurchaseRequestRepository
  eventBus: IEventBus
}

/**
 * PurchaseNewUserUseCase
 *
 * Handles the complete subscription purchase flow for new users:
 * 1. Product validation
 * 2. Card creation (with null user_id, updated after user creation)
 * 3. User creation via main API
 * 4. Initial payment processing
 * 5. Subscription creation
 * 6. Event publishing (UserCreated, CardCreated, SubscriptionCreated, PaymentProcessed)
 */
export class PurchaseNewUserUseCase implements IPurchaseNewUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: NewUserPurchaseInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = new Date()
    let purchaseRequestId: number | null = null

    try {
      // Validate input (before tracking — early return, no markAsFailed needed)
      const validationResult = NewUserPurchaseInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((i) => i.message).join(", ")
        logger.error("New user purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const v = validationResult.data
      const productIdNum = parseProductId(v.productId)

      // Track the request
      const purchaseRequest = await createPurchaseRequest(this.deps, {
        productIdNum,
        email: v.email,
        userId: null,
        input: v,
      })
      purchaseRequestId = purchaseRequest.request_id

      logger.info("Processing new user purchase", { purchaseRequestId, productId: v.productId, email: v.email })
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "VALIDATING")

      // Validate product
      const { product, productData, userConfig } = await validateAndParseProduct(
        this.deps,
        productIdNum,
        purchaseRequestId
      )

      // Create card and user
      const { userId, cardIdString } = await this.createCardAndUser(
        v,
        input.context,
        userConfig,
        product.product_id,
        purchaseRequestId
      )

      // Resolve card row for payment
      const userCard = await resolveCardRecord(this.deps, cardIdString, purchaseRequestId)

      // Process payment
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")
      const pricing = calculatePricing(product, productData)
      const payment = await processInitialPayment(this.deps, userCard, pricing, input.context, purchaseRequestId)

      // Create subscription
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")
      const subscription = await createSubscriptionRecord(this.deps, { userId, product, pricing, payment, userConfig })

      // Log transaction
      const transaction = await createTransactionRecord(this.deps, { userId, product, pricing, payment })

      // Publish events and finalize
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")
      await publishPurchaseEvents(this.deps, {
        purchaseRequestId,
        purchaseRequestUuid: purchaseRequest.request_uuid,
        userId,
        email: v.email,
        product,
        subscription,
        transaction,
        pricing,
        payment,
        cardIdString,
        userCard,
        userWasCreated: true,
        startTime,
      })

      logger.info("New user purchase completed successfully", {
        userId,
        subscriptionId: subscription.subscription_id,
        amount: pricing.initialAmount,
        duration: new Date().getTime() - startTime.getTime(),
      })

      return success({
        subscriptionId: subscription.subscription_id,
        userId,
        cardId: cardIdString,
        productId: v.productId,
        amount: pricing.initialAmount,
        proratedCharge: 0,
        userCreated: true,
      })
    } catch (error) {
      return this.handleError(error, purchaseRequestId, startTime)
    }
  }

  private async createCardAndUser(
    v: NewUserPurchaseInputValidated,
    context: PaymentContext | null | undefined,
    userConfig: ProductUserConfig | undefined,
    productId: number,
    purchaseRequestId: number
  ): Promise<{ userId: number; cardIdString: string }> {
    // Create card first with null userId (bound to the user after creation)
    const cardResult = await createCardHelper(
      {
        logger: this.deps.logger,
        paymentProvider: this.deps.paymentProvider,
        userCardRepository: this.deps.userCardRepository,
        eventBus: this.deps.eventBus,
      },
      null,
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
      throw new PurchaseError(cardResult.error || "Card creation failed", "CARD_CREATION_FAILED")
    }

    // Create user in main API
    let userId: number
    try {
      const newUser = await this.deps.userApiClient.createUser({
        email: v.email,
        phone: v.phone,
        is_premium: userConfig?.is_premium,
        role: userConfig?.role,
        whitelabel_id: userConfig?.whitelabel_id ?? 4,
      })
      userId = newUser.id
      this.deps.logger.info("New user created", { userId })

      await this.deps.purchaseRequestRepository.update(purchaseRequestId, {
        user_id: userId,
        user_created: 1,
      })

      // Bind card to the new user
      const cards = await this.deps.userCardRepository.findAll({ card_id: cardResult.cardId })
      if (cards.length > 0) {
        await this.deps.userCardRepository.update(cards[0].id, {
          user_id: userId,
          updatedAt: new Date(),
        })
      }

      await this.deps.eventBus.publish(
        UserCreatedEvent.create({
          userId,
          email: v.email,
          creationSource: "purchase_flow",
          productId,
        })
      )
    } catch (error) {
      if (error instanceof PurchaseError) throw error
      this.deps.logger.error("Failed to create user", { error })
      throw new PurchaseError("Failed to create user", "USER_CREATION_FAILED")
    }

    return { userId, cardIdString: cardResult.cardId! }
  }

  private async handleError(
    error: unknown,
    purchaseRequestId: number | null,
    startTime: Date
  ): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorCode = error instanceof PurchaseError ? error.code : "PURCHASE_ERROR"

    this.deps.logger.error("New user purchase error", {
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
