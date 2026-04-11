import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IUserApiClient } from "@api/infrastructure/external-api/user-api.interface"
import type { ProductRepository } from "@api/lib/repositories"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { UserCardRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { PurchaseRequestRepository } from "@api/lib/repositories"
import type { HomeUptickSubscriptionRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IPurchaseNewUserUseCase } from "./purchase-new-user.use-case.interface"
import { NewUserPurchaseInput, PurchaseSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { NewUserPurchaseInputSchema, NewUserPurchaseInputValidated } from "../types/validation.schemas"
import { ProductUserConfig } from "@api/domain/types/product-data.types"
import type { PaymentContext } from "@api/config/config.interface"
import { UserCreatedEvent } from "@api/domain/events/user-created.event"
import { UserProvisioningFailedEvent } from "@api/domain/events/user-provisioning-failed.event"
import { createElement } from "react"
import { render } from "@react-email/render"

import UserProvisioningFailedEmail from "@api/infrastructure/email/templates/user-provisioning-failed.email"
import {
  PurchaseError,
  PurchasePricing,
  parseProductId,
  calculatePricing,
  createPurchaseRequest,
  validateAndParseProduct,
  resolveCardRecord,
  processInitialPayment,
  createPaymentTransactionRecord,
  createSubscriptionRecord,
  createTransactionRecord,
  publishPurchaseEvents,
  createCardHelper,
  isUserFacingError,
  sendSystemErrorAlert,
  sendCustomerPurchaseErrorEmail,
  seedHomeUptickSubscription,
} from "./purchase-helpers"
import { whitelabelResolverService } from "@api/lib/services"
import { generateResetToken } from "@api/utils/generate-reset-token"
import { formatMySQLDatetime } from "@api/utils/format-mysql-datetime"

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
  homeUptickSubscriptionRepository: HomeUptickSubscriptionRepository
  eventBus: IEventBus
  /** Email address to notify when user provisioning fails after a successful payment */
  adminAlertEmail: string
}

interface RollbackContext {
  paymentId: string | null
  pricing: PurchasePricing | null
  context: PaymentContext | null | undefined
  /** Once true, the subscription exists and the refund gate is closed */
  subscriptionCreated: boolean
}

type ProvisioningResult =
  | { success: true; userId: number }
  | { success: false; reason: string }

/**
 * PurchaseNewUserUseCase
 *
 * Payment-first architecture:
 * 1. Validate product
 * 2. Create card via Square
 * 3. Process payment
 * 4. Create subscription (user_id = null, provisioning_status = null)
 * 5. Create transaction record
 * 6. Attempt user provisioning (non-blocking)
 *    - Success → bind card + update subscription.user_id → emit UserCreated
 *    - Failure → mark subscription as pending_provisioning, send admin alert, return success
 * 7. Publish events and finalize
 *
 * If anything fails before the subscription is created, the payment is refunded.
 * Once the subscription exists, no refund is issued — the subscription record is
 * the source of truth for what was purchased.
 */
export class PurchaseNewUserUseCase implements IPurchaseNewUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: NewUserPurchaseInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const { logger } = this.deps
    const startTime = new Date()
    let purchaseRequestId: number | null = null
    let capturedEmail: string | null = null
    let capturedProductId: string | number | null = null
    let capturedWhitelabelName: string | null = null

    const rollback: RollbackContext = {
      paymentId: null,
      pricing: null,
      context: input.context,
      subscriptionCreated: false,
    }

    try {
      // Validate input (early return — no purchase request yet)
      const validationResult = NewUserPurchaseInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((i) => i.message).join(", ")
        logger.error("New user purchase validation failed", { errors, input })
        return failure(errors, "PURCHASE_VALIDATION_ERROR")
      }

      const v = validationResult.data
      const productIdNum = parseProductId(v.productId)
      capturedEmail = v.email
      capturedProductId = v.productId

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

      // Resolve whitelabel from product's whitelabel_code column
      let resolvedWhitelabelId: number | undefined
      if (product.whitelabel_code) {
        try {
          const resolved = await whitelabelResolverService.resolveByCode(product.whitelabel_code)
          capturedWhitelabelName = resolved.name
          resolvedWhitelabelId = resolved.whitelabel_id
        } catch {
          // Non-critical — falls back to "CashOffers" in email subject
        }
      }

      // Calculate pricing to determine if this is a free purchase
      const pricing = calculatePricing(product, productData)
      rollback.pricing = pricing
      const isFree = pricing.initialAmount === 0

      let cardIdString: string | null = null
      let userCard: { card_id: string | null; square_customer_id: string | null; last_4: string | null } | null = null
      let payment: { id: string; environment: "production" | "sandbox" } | null = null
      let paymentTransaction: { transaction_id: number } | null = null

      if (isFree) {
        // Free product — skip card creation and payment
        logger.info("Free product purchase — skipping card and payment", { productId: v.productId })
      } else {
        // Paid product — create card, resolve card record, process payment
        cardIdString = await this.createCard(v, input.context)
        userCard = await resolveCardRecord(this.deps, cardIdString, purchaseRequestId)

        await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "PROCESSING_PAYMENT")
        payment = await processInitialPayment(this.deps, userCard, pricing, input.context, purchaseRequestId)
        rollback.paymentId = payment.id

        // Log payment transaction
        paymentTransaction = await createPaymentTransactionRecord(this.deps, {
          userId: null,
          product,
          pricing,
          payment,
        })
      }

      // Create subscription before user exists — refund gate closes here
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")
      const subscription = await createSubscriptionRecord(this.deps, {
        userId: null,
        product,
        pricing,
        payment,
        userConfig,
        cashoffers: productData.cashoffers,
      })
      rollback.subscriptionCreated = true

      // Log transaction
      const transaction = await createTransactionRecord(this.deps, {
        userId: null,
        product,
        pricing,
        payment,
      })

      // Attempt user provisioning — non-blocking, never throws
      const provisioning = await this.attemptUserProvisioning(v, userConfig, productData, product.product_id, {
        purchaseRequestId,
        subscriptionId: subscription.subscription_id,
        transactionId: transaction.transaction_id,
        paymentTransactionId: paymentTransaction?.transaction_id ?? null,
        cardIdString,
        isFree,
        resolvedWhitelabelId,
        whitelabelName: capturedWhitelabelName ?? undefined,
      })

      const userId = provisioning.success ? provisioning.userId : null

      // Seed HomeUptick subscription from product template (requires userId)
      if (provisioning.success) {
        try {
          await seedHomeUptickSubscription(
            { logger, homeUptickSubscriptionRepository: this.deps.homeUptickSubscriptionRepository },
            { userId: provisioning.userId, productData }
          )
        } catch (huError) {
          logger.error("Failed to seed HomeUptick subscription", {
            userId: provisioning.userId,
            subscriptionId: subscription.subscription_id,
            error: huError instanceof Error ? huError.message : String(huError),
          })
          // Non-blocking — the subscription was already created successfully
        }
      }

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
        userWasCreated: provisioning.success,
        startTime,
      })

      logger.info("New user purchase completed", {
        userId,
        subscriptionId: subscription.subscription_id,
        userProvisioned: provisioning.success,
        amount: pricing.initialAmount,
        duration: new Date().getTime() - startTime.getTime(),
      })

      return success({
        subscriptionId: subscription.subscription_id,
        userId,
        cardId: cardIdString ?? "",
        productId: v.productId,
        amount: pricing.initialAmount,
        proratedCharge: 0,
        userCreated: provisioning.success,
        userProvisioned: provisioning.success,
      })
    } catch (error) {
      return this.handleError(error, purchaseRequestId, rollback, startTime, {
        email: capturedEmail,
        productId: capturedProductId,
        whitelabelName: capturedWhitelabelName ?? undefined,
      })
    }
  }

  private async createCard(
    v: NewUserPurchaseInputValidated,
    context: PaymentContext | null | undefined
  ): Promise<string> {
    const cardResult = await createCardHelper(
      {
        logger: this.deps.logger,
        paymentProvider: this.deps.paymentProvider,
        userCardRepository: this.deps.userCardRepository,
        transactionRepository: this.deps.transactionRepository,
        eventBus: this.deps.eventBus,
      },
      null,
      {
        email: v.email,
        cardToken: v.cardToken!,
        expMonth: v.expMonth!,
        expYear: v.expYear!,
        cardholderName: v.cardholderName!,
        context,
      }
    )

    if (!cardResult.success) {
      throw new PurchaseError(cardResult.error || "Card creation failed", cardResult.squareCode || "CARD_CREATION_FAILED")
    }

    return cardResult.cardId!
  }

  /**
   * Attempts to create the user account in the main API and bind them to the
   * subscription and card. Never throws — provisioning failure is handled
   * gracefully by marking the subscription as pending_provisioning and alerting admin.
   */
  private async attemptUserProvisioning(
    v: NewUserPurchaseInputValidated,
    userConfig: ProductUserConfig | undefined,
    productData: import("@api/domain/types/product-data.types").ProductData | undefined,
    productId: number,
    context: {
      purchaseRequestId: number
      subscriptionId: number
      transactionId: number
      paymentTransactionId: number | null
      cardIdString: string | null
      isFree: boolean
      whitelabelName?: string
      resolvedWhitelabelId?: number
    }
  ): Promise<ProvisioningResult> {
    const { logger } = this.deps
    const resolvedWhitelabelId = context.resolvedWhitelabelId

    try {
      const resetToken = generateResetToken()
      const isTeamPlan = userConfig?.is_team_plan === true

      // For team plans, create user as SHELL first, then create team, then update user with team_id + role
      const newUser = await this.deps.userApiClient.createUser({
        email: v.email,
        name: v.name || v.cardholderName || v.email,
        phone: v.phone,
        is_premium: userConfig?.is_premium,
        role: isTeamPlan ? "SHELL" : userConfig?.role,
        whitelabel_id: resolvedWhitelabelId ?? 4,
        reset_token: resetToken,
        reset_created: formatMySQLDatetime(),
      })
      const userId = newUser.id

      // For team plans: create team, then update user with team_id and TEAMOWNER role
      if (isTeamPlan) {
        const ownerName = v.name || v.cardholderName || v.email
        const teamName = `${ownerName}'s team`
        const team = await this.deps.userApiClient.createTeam({
          teamname: teamName,
          owner_id: userId,
          max_users: userConfig?.team_members ?? 6,
          whitelabel_id: resolvedWhitelabelId,
        })
        await this.deps.userApiClient.updateUser(userId, {
          team_id: team.id,
          role: userConfig?.role,
        })

        // Store team_id in subscription data so team suspension/toggle flows can find members
        try {
          const sub = await this.deps.subscriptionRepository.findById(context.subscriptionId)
          if (sub) {
            const subData = typeof sub.data === "string" ? JSON.parse(sub.data) : (sub.data || {})
            subData.team_id = team.id
            await this.deps.subscriptionRepository.update(context.subscriptionId, {
              data: JSON.stringify(subData),
            })
          }
        } catch (err) {
          logger.warn("Failed to store team_id in subscription data", {
            subscriptionId: context.subscriptionId,
            teamId: team.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }

        logger.info("Team created and user promoted to TEAMOWNER", {
          userId,
          teamId: team.id,
          teamName,
        })
      }

      logger.info("User provisioned successfully", { userId, subscriptionId: context.subscriptionId })

      // Bind card to the new user (skip for free purchases with no card)
      const cards = context.cardIdString
        ? await this.deps.userCardRepository.findAll({ card_id: context.cardIdString })
        : []
      if (cards.length > 0) {
        await this.deps.userCardRepository.update(cards[0].id, {
          user_id: userId,
          updatedAt: new Date(),
        })

        // Link the "Card Created" transaction to the new user
        const cardTransactions = await this.deps.transactionRepository.findAll({
          type: "card",
          user_id: 0,
        })
        const cardTransaction = cardTransactions.find((t) => {
          try {
            const data = JSON.parse(t.data ?? "{}")
            return data.cardId === context.cardIdString
          } catch {
            return false
          }
        })
        if (cardTransaction) {
          await this.deps.transactionRepository.update(cardTransaction.transaction_id, {
            user_id: userId,
          })
        }
      }

      // Bind subscription to the new user
      await this.deps.subscriptionRepository.update(context.subscriptionId, {
        user_id: userId,
        provisioning_status: "provisioned",
        updatedAt: new Date(),
      })

      // Link subscription transaction to the new user
      await this.deps.transactionRepository.update(context.transactionId, {
        user_id: userId,
      })

      // Link payment transaction to the new user
      if (context.paymentTransactionId) {
        await this.deps.transactionRepository.update(context.paymentTransactionId, {
          user_id: userId,
        })
      }

      // Update purchase request with the new user id
      await this.deps.purchaseRequestRepository.update(context.purchaseRequestId, {
        user_id: userId,
        user_created: 1,
      })

      // Publish UserCreated event
      await this.deps.eventBus.publish(
        UserCreatedEvent.create({
          userId,
          email: v.email,
          creationSource: "purchase_flow",
          productId,
          subscriptionId: context.subscriptionId,
        })
      )

      return { success: true, userId }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      logger.error("User provisioning failed after successful payment", {
        email: v.email,
        subscriptionId: context.subscriptionId,
        purchaseRequestId: context.purchaseRequestId,
        error: reason,
      })

      // Mark subscription as needing manual intervention
      try {
        await this.deps.subscriptionRepository.update(context.subscriptionId, {
          provisioning_status: "pending_provisioning",
          updatedAt: new Date(),
        })
      } catch (updateError) {
        logger.error("Failed to mark subscription as pending_provisioning", {
          subscriptionId: context.subscriptionId,
          updateError,
        })
      }

      // Publish observable event for monitoring
      try {
        await this.deps.eventBus.publish(
          UserProvisioningFailedEvent.create({
            subscriptionId: context.subscriptionId,
            purchaseRequestId: context.purchaseRequestId,
            email: v.email,
            productId,
            cardId: context.cardIdString ?? "",
            errorMessage: reason,
          })
        )
      } catch (eventError) {
        logger.error("Failed to publish UserProvisioningFailed event", { eventError })
      }

      // Alert admin
      await this.alertProvisioningFailure({
        email: v.email,
        subscriptionId: context.subscriptionId,
        purchaseRequestId: context.purchaseRequestId,
        productId,
        errorDetail: reason,
        isFree: context.isFree,
      })

      // Notify the customer that account setup failed
      await sendCustomerPurchaseErrorEmail(
        { emailService: this.deps.emailService, logger: this.deps.logger },
        {
          email: v.email,
          reason: "We were unable to finish setting up your account. Our team has been notified and will reach out to you shortly.",
          isFree: context.isFree,
          whitelabelName: context.whitelabelName,
        }
      )

      return { success: false, reason }
    }
  }

  private async alertProvisioningFailure(params: {
    email: string
    subscriptionId: number
    purchaseRequestId: number
    productId: number
    errorDetail: string
    isFree?: boolean
  }): Promise<void> {
    try {
      const html = await render(
        createElement(UserProvisioningFailedEmail, {
          subscriptionId: params.subscriptionId,
          purchaseRequestId: params.purchaseRequestId,
          email: params.email,
          productId: params.productId,
          errorDetail: params.errorDetail,
          occurredAt: new Date().toISOString(),
          isFree: params.isFree,
        })
      )
      await this.deps.emailService.sendEmail({
        to: this.deps.adminAlertEmail,
        subject: `[ACTION REQUIRED] User provisioning failed — subscription #${params.subscriptionId}`,
        html,
        templateName: "user-provisioning-failed",
      })
    } catch (alertError) {
      this.deps.logger.error("Failed to send provisioning failure admin alert", { alertError, ...params })
    }
  }

  private async handleError(
    error: unknown,
    purchaseRequestId: number | null,
    rollback: RollbackContext,
    startTime: Date,
    context: { email: string | null; productId: string | number | null; whitelabelName?: string }
  ): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    const { logger } = this.deps
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorCode = error instanceof PurchaseError ? error.code : "PURCHASE_ERROR"
    const durationMs = new Date().getTime() - startTime.getTime()

    logger.error("New user purchase error", { error: errorMessage, duration: durationMs })

    if (purchaseRequestId && !(error instanceof PurchaseError)) {
      try {
        await this.deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, errorMessage, errorCode)
      } catch (updateError) {
        logger.error("Failed to update purchase request status", { updateError })
      }
    }

    // No automatic refund — payment is kept and admin manually provisions the
    // subscription/user. The purchase request and system error alert contain
    // all the context needed for manual resolution.

    // Alert developer for system errors (not user-fixable card/input errors)
    if (!isUserFacingError(errorCode)) {
      await sendSystemErrorAlert(
        {
          emailService: this.deps.emailService,
          logger,
          adminAlertEmail: this.deps.adminAlertEmail,
        },
        {
          flow: "new-user-purchase",
          errorCode,
          errorMessage,
          errorStack,
          purchaseRequestId,
          productId: context.productId,
          email: context.email,
          paymentId: rollback.paymentId,
          subscriptionCreated: rollback.subscriptionCreated,
          durationMs,
        }
      )

      // Notify the customer if a payment was taken (regardless of whether it was refunded)
      if (rollback.paymentId && context.email) {
        await sendCustomerPurchaseErrorEmail(
          { emailService: this.deps.emailService, logger },
          {
            email: context.email,
            reason: "Something went wrong while processing your purchase. Our team has been notified and will reach out to you shortly.",
            amountCharged: rollback.pricing?.initialAmount,
            whitelabelName: context.whitelabelName,
          }
        )
      }
    }

    return failure(errorMessage, errorCode)
  }
}
