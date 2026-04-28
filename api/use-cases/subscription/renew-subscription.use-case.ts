import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import type { SubscriptionRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { UserCardRepository } from "@api/lib/repositories"
import type { PurchaseRequestRepository } from "@api/lib/repositories"
import { IConfigService } from "@api/config/config.interface"
import { ITransactionManager } from "@api/infrastructure/database/transaction/transaction-manager.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { IRenewSubscriptionUseCase } from "./renew-subscription.use-case.interface"
import { RenewSubscriptionInput, RenewSubscriptionOutput } from "../types/subscription.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { RenewSubscriptionInputSchema } from "../types/validation.schemas"
import { v4 as uuidv4 } from "uuid"
import { SubscriptionMapper } from "@api/domain"
import { SubscriptionRenewedEvent } from "@api/domain/events/subscription-renewed.event"
import { PaymentProcessedEvent } from "@api/domain/events/payment-processed.event"
import { PaymentFailedEvent } from "@api/domain/events/payment-failed.event"
import { SubscriptionDeactivatedEvent } from "@api/domain/events/subscription-deactivated.event"
import { SubscriptionCancelledEvent } from "@api/domain/events/subscription-cancelled.event"
import type { IHomeUptickApiClient } from "@api/infrastructure/external-api/homeuptick-api/homeuptick-api.interface"
import type { ProductData } from "@api/domain/types/product-data.types"
import type { WhitelabelRepository, ProductRepository, HomeUptickSubscriptionRepository } from "@api/lib/repositories"
import type { ICriticalAlertService } from "@api/domain/services/critical-alert.service"
import { SquareApiError, isCriticalSquareError } from "@api/infrastructure/payment/error/payment-error.types"
import type { IPaymentErrorTranslator } from "@api/infrastructure/payment/error/payment-error-translator.interface"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  subscriptionRepository: SubscriptionRepository
  transactionRepository: TransactionRepository
  userCardRepository: UserCardRepository
  purchaseRequestRepository: PurchaseRequestRepository
  productRepository?: ProductRepository
  config: IConfigService
  transactionManager: ITransactionManager
  eventBus: IEventBus
  homeUptickApiClient?: IHomeUptickApiClient
  homeUptickSubscriptionRepository?: HomeUptickSubscriptionRepository
  whitelabelRepository?: WhitelabelRepository
  criticalAlertService?: ICriticalAlertService
  paymentErrorTranslator?: IPaymentErrorTranslator
  adminAlertEmail?: string
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
    let isCancelOnRenewal = false

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
      const subscription = await this.deps.subscriptionRepository.findById(validatedInput.subscriptionId)
      if (!subscription) {
        logger.warn("Subscription not found", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription not found", "SUBSCRIPTION_NOT_FOUND")
      }

      if (!subscription.product_id) {
        logger.error("Subscription missing product_id", { subscriptionId: validatedInput.subscriptionId })
        return failure("Subscription has no product", "INVALID_SUBSCRIPTION")
      }

      // Idempotency guard: if another RENEWAL is already in flight for this
      // subscription (e.g. cron and a card-update fired within the same tick),
      // skip rather than charge the card a second time. This is defense in
      // depth — the upstream callers should already be deduping by the time
      // they reach here.
      if (this.deps.purchaseRequestRepository.findInFlightRenewal) {
        const inFlight = await this.deps.purchaseRequestRepository.findInFlightRenewal(
          validatedInput.subscriptionId
        )
        if (inFlight) {
          logger.info("Skipping renewal: another renewal already in flight", {
            subscriptionId: validatedInput.subscriptionId,
            inFlightRequestId: inFlight.request_id,
            inFlightStatus: inFlight.status,
          })
          return success({
            subscriptionId: validatedInput.subscriptionId,
            transactionId: "",
            nextRenewalDate: subscription.renewal_date
              ? new Date(subscription.renewal_date)
              : new Date(),
            amount: 0,
            skipped: true,
          })
        }
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

      // Look up product data for event metadata (cashoffers config, etc.)
      const subscriptionData = subscription.data
        ? typeof subscription.data === "string"
          ? JSON.parse(subscription.data)
          : subscription.data
        : {}
      let productData: ProductData | undefined = subscriptionData?.productData

      // Fall back to product lookup when productData isn't embedded in subscription data
      if (!productData && subscription.product_id && this.deps.productRepository) {
        try {
          const product = await this.deps.productRepository.findById(subscription.product_id)
          if (product?.data) {
            productData = typeof product.data === "object" ? (product.data as ProductData) : undefined
          }
        } catch {
          logger.warn("Failed to look up product for renewal", { productId: subscription.product_id })
        }
      }

      // Add HomeUptick addon charge based on live Homeuptick_Subscriptions record (source of truth).
      // If the HU API fails, skip the addon charge and alert admin — don't block the
      // base subscription renewal. The user still gets their subscription renewed;
      // the HU addon can be reconciled later.
      if (this.deps.homeUptickSubscriptionRepository && this.deps.homeUptickApiClient) {
        const huSubscription = await this.deps.homeUptickSubscriptionRepository.findActiveByUserId(subscription.user_id!)

        if (huSubscription) {
          const baseContacts = huSubscription.base_contacts ?? 0
          const contactsPerTier = huSubscription.contacts_per_tier ?? 500
          const pricePerTier = huSubscription.price_per_tier ?? 7500

          let contacts: number
          try {
            contacts = await this.deps.homeUptickApiClient.getClientCount(subscription.user_id!)
          } catch (huError: any) {
            const huErrorMsg = huError instanceof Error ? huError.message : "Unknown HU API error"
            const isAxios401 = huError?.response?.status === 401

            if (isAxios401) {
              // 401 means the user's api_token is invalid/expired — treat as 0 contacts silently
              logger.debug("HomeUptick API returned 401 — treating as 0 contacts", {
                userId: subscription.user_id,
                subscriptionId: validatedInput.subscriptionId,
              })
            } else {
              logger.warn("HomeUptick API failure during renewal — skipping HU addon, renewing base only", {
                userId: subscription.user_id,
                subscriptionId: validatedInput.subscriptionId,
                error: huErrorMsg,
              })

              // Notify admin — HU addon was skipped, may need manual reconciliation
              if (this.deps.criticalAlertService) {
                try {
                  await this.deps.criticalAlertService.alertCriticalError(
                    "HomeUptick API Failure During Renewal",
                    huError instanceof Error ? huError : new Error(huErrorMsg),
                    {
                      subscriptionId: validatedInput.subscriptionId,
                      userId: subscription.user_id,
                      email: validatedInput.email,
                      impact: "HU addon skipped — base subscription renewed without HU tier charge",
                      action: "Investigate HomeUptick API issue. HU addon may need manual reconciliation for this billing cycle.",
                    }
                  )
                } catch (alertError) {
                  logger.error("Failed to send HU API failure admin alert", { alertError })
                }
              }
            }

            // Fall through — renewal continues with base amount only
            contacts = 0
          }

          let tier = 1
          if (contacts > baseContacts) {
            tier = Math.ceil((contacts - baseContacts) / contactsPerTier) + 1
          }

          const huAddon = (tier - 1) * pricePerTier
          if (huAddon > 0) {
            totalAmount += huAddon
            lineItems.push({
              item: `HomeUptick — Tier ${tier} (${contacts} contacts)`,
              price: huAddon,
            })
          }
        }
      }

      // Convert to domain entity
      const subscriptionEntity = SubscriptionMapper.toDomain(subscription as any)

      // Check if subscription should be cancelled on renewal
      if (subscriptionEntity.cancelOnRenewal) {
        isCancelOnRenewal = true
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

        const cancelMetadata: Record<string, unknown> = {}
        if (productData) cancelMetadata.productData = productData

        if (this.deps.whitelabelRepository && this.deps.productRepository && subscription.product_id) {
          try {
            const product = await this.deps.productRepository.findById(subscription.product_id)
            if (product?.whitelabel_code) {
              const behavior = await this.deps.whitelabelRepository.getSuspensionBehaviorByCode(product.whitelabel_code)
              if (behavior) cancelMetadata.suspensionStrategy = behavior
            }
          } catch {
            logger.warn("Failed to resolve suspension strategy for cancel-on-renewal", {
              subscriptionId: validatedInput.subscriptionId,
            })
          }
        }

        await this.deps.eventBus.publish(
          SubscriptionCancelledEvent.create(
            {
              subscriptionId: validatedInput.subscriptionId,
              userId: subscription.user_id!,
              email: validatedInput.email,
              subscriptionName: subscription.subscription_name ?? undefined,
              reason: "cancel_on_renewal",
              cancelledBy: "user",
              cancelOnRenewal: false,
            },
            cancelMetadata
          )
        )

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
      let paymentEnvironment: "production" | "sandbox" = "production"
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

      // Log payment transaction (separate from the subscription renewal transaction)
      if (paymentId && totalAmount > 0) {
        const now = new Date()
        await this.deps.transactionRepository.create({
          user_id: subscription.user_id!,
          amount: totalAmount,
          type: "payment",
          memo: `Payment processed: ${subscription.subscription_name || "Subscription"} renewal`,
          status: "completed",
          square_transaction_id: paymentId,
          square_environment: paymentEnvironment,
          product_id: subscription.product_id,
          data: JSON.stringify({ lineItems }),
          createdAt: now,
          updatedAt: now,
        })
      }

      // Update status to CREATING_SUBSCRIPTION (updating renewal)
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "CREATING_SUBSCRIPTION")

      // Use domain entity to handle renewal logic
      const renewedEntity = subscriptionEntity.renew()
      const newRenewalDate = renewedEntity.renewalDate

      let transactionId: number | null = null

      // Update subscription and log transaction atomically
      await this.deps.transactionManager.runInTransaction(async (trx) => {
        // Update subscription with renewed entity data. Explicitly clear
        // suspension_date: it lives on the DB row but not on the domain
        // entity, so the mapper alone leaves a stale value behind after a
        // suspended subscription is successfully renewed.
        await this.deps.subscriptionRepository.update(
          validatedInput.subscriptionId,
          {
            ...(SubscriptionMapper.toDatabase(renewedEntity) as any),
            suspension_date: null,
          },
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
        })
        transactionId = transaction.transaction_id
      })

      // Update status to FINALIZING
      await this.deps.purchaseRequestRepository.updateStatus(purchaseRequestId, "FINALIZING")

      // Publish domain events for subscription renewal (include productData in metadata for handlers)
      const renewMetadata: Record<string, unknown> = {}
      if (productData) renewMetadata.productData = productData

      await this.deps.eventBus.publish(
        SubscriptionRenewedEvent.create(
          {
            subscriptionId: validatedInput.subscriptionId,
            userId: subscription.user_id!,
            email: validatedInput.email,
            productId: subscription.product_id,
            productName: subscription.subscription_name || "Subscription",
            amount: totalAmount,
            transactionId: transactionId || undefined,
            externalTransactionId: paymentId || undefined,
            cardId: cardId || undefined,
            nextRenewalDate: newRenewalDate,
            environment: paymentEnvironment,
            lineItems: lineItems.map((item) => ({ description: item.item, amount: item.price })),
          },
          renewMetadata
        )
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
      const rawErrorMessage = error instanceof Error ? error.message : "Unknown error"
      const squareCode = error instanceof SquareApiError ? error.squareCode : undefined
      const isCriticalSquare = isCriticalSquareError(error)

      // Translate Square errors into a user-friendly message. Card declines
      // (including TRANSACTION_LIMIT) should surface to the user as a clear
      // decline reason, not as raw Square API output.
      let userFacingMessage = rawErrorMessage
      if (error instanceof SquareApiError && this.deps.paymentErrorTranslator && !isCriticalSquare) {
        const translated = this.deps.paymentErrorTranslator.translate(error)
        userFacingMessage = translated.message
      }

      logger.error("Subscription renewal error", {
        error: rawErrorMessage,
        subscriptionId: input.subscriptionId,
        duration: new Date().getTime() - startTime.getTime(),
        squareCode,
        criticalSquareError: isCriticalSquare || undefined,
      })

      // Mark purchase request as failed if it was created
      if (purchaseRequestId) {
        try {
          await this.deps.purchaseRequestRepository.markAsFailed(
            purchaseRequestId,
            rawErrorMessage,
            isCriticalSquare ? "SQUARE_PLATFORM_ERROR" : "RENEWAL_ERROR"
          )
        } catch (updateError) {
          logger.error("Failed to update purchase request status", { updateError })
        }
      }

      // Critical Square errors = platform/auth/outage problems that will keep
      // failing until a developer fixes something (invalid token, disabled app,
      // Square outage, etc.). Page the developer immediately, don't spam the
      // user, and don't burn their retry budget.
      if (isCriticalSquare && this.deps.criticalAlertService) {
        try {
          await this.deps.criticalAlertService.alertSquareApiFailure(
            error instanceof Error ? error : new Error(rawErrorMessage),
            {
              subscriptionId: input.subscriptionId,
              email: input.email,
              squareCode,
              impact:
                "Renewal blocked by Square platform error. User was NOT charged and retry budget was NOT consumed.",
              action:
                "Check Square credentials, application status, and Square's status page. Once resolved, the subscription will retry on its existing schedule.",
            }
          )
        } catch (alertError) {
          logger.error("Failed to send Square critical alert", { alertError })
        }

        return failure(rawErrorMessage, "SQUARE_PLATFORM_ERROR")
      }

      if (isCancelOnRenewal) {
        // Errors during cancel-on-renewal should never produce a payment failed email.
        // Notify the developer and leave the user alone.
        if (this.deps.adminAlertEmail) {
          try {
            await this.deps.emailService.sendEmail({
              to: this.deps.adminAlertEmail,
              subject: `[ERROR] Cancel-on-renewal failed — subscription ${input.subscriptionId}`,
              html: `<p>An error occurred while processing a cancel-on-renewal for subscription <strong>${input.subscriptionId}</strong> (user: ${input.email}).</p><p><strong>Error:</strong> ${rawErrorMessage}</p>`,
              templateName: "system-error",
            })
          } catch (alertError) {
            logger.error("Failed to send cancel-on-renewal error alert", { alertError })
          }
        }
      } else {
        // Pass the user-friendly message + Square code through so the
        // PaymentFailed email shows a human-readable decline reason.
        await this.handleRenewalFailure(
          input.subscriptionId,
          input.email,
          userFacingMessage,
          input.triggeredBy,
          squareCode
        )
      }

      return failure(rawErrorMessage, "RENEWAL_ERROR")
    }
  }

  private async processRenewalPayment(
    userId: number,
    email: string,
    amount: number,
    subscriptionName: string,
    lineItems: LineItem[],
    subscriptionId: number
  ): Promise<{ paymentId: string; cardId: string; environment: "production" | "sandbox" }> {
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
    const environment = (userCard.square_environment || subscription?.square_environment || "production") as
      | "production"
      | "sandbox"

    // Create PaymentContext with testMode based on environment
    const context: import("@api/config/config.interface").PaymentContext = {
      testMode: environment === "sandbox",
      source: "CRON",
      userId,
      metadata: {
        subscriptionId,
        detectedEnvironment: environment,
      },
    }

    logger.info("Processing renewal payment with detected environment", {
      userId,
      subscriptionId,
      environment,
      testMode: context.testMode,
    })

    // Create payment with correct environment context
    const payment = await paymentProvider.createPayment(
      {
        sourceId: userCard.card_id,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(amount),
          currency: "USD",
        },
        customerId: userCard.square_customer_id,
        note: `Renewal: ${subscriptionName}`,
      },
      context
    ) // Pass context with correct testMode

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
    error: string,
    triggeredBy?: "cron" | "card_update",
    errorCode?: string
  ): Promise<void> {
    const { logger, eventBus, subscriptionRepository, transactionRepository } = this.deps

    try {
      // Get subscription for details
      const subscription = await subscriptionRepository.findById(subscriptionId)
      if (!subscription) return

      const failureCount = (subscription.payment_failure_count as number | null) ?? 0
      const now = new Date()
      const isCardUpdate = triggeredBy === "card_update"

      if (isCardUpdate) {
        // Card-update-triggered failures do not consume a retry slot.
        // Keep payment_failure_count and next_renewal_attempt exactly as they are;
        // just notify the user that the new card was declined.
        const existingNextAttempt = subscription.next_renewal_attempt
          ? new Date(subscription.next_renewal_attempt as unknown as string)
          : undefined

        await transactionRepository.create({
          user_id: subscription.user_id!,
          amount: subscription.amount || 0,
          type: "subscription",
          memo: `${subscription.subscription_name || "Subscription"} (new card declined)`,
          status: "failed",
          square_environment: subscription.square_environment || "production",
          data: JSON.stringify({ error, triggeredBy }),
          createdAt: now,
          updatedAt: now,
        })

        await eventBus.publish(
          PaymentFailedEvent.create({
            userId: subscription.user_id!,
            email,
            amount: subscription.amount || 0,
            currency: "USD",
            paymentProvider: "Square",
            subscriptionId,
            productId: subscription.product_id || undefined,
            productName: subscription.subscription_name ?? undefined,
            paymentType: "renewal",
            environment: subscription.square_environment || "production",
            errorMessage: error,
            errorCode: errorCode ?? "CARD_DECLINED",
            willRetry: existingNextAttempt !== undefined,
            nextRetryDate: existingNextAttempt,
            triggerSource: "card_update",
          })
        )

        logger.info("Card-update renewal failure handled (failure count unchanged)", {
          subscriptionId,
          existingNextAttempt,
          error,
        })
        return
      }

      // Scheduled retry path: escalating intervals, auto-suspend after max attempts
      const nextAttempt = this.calculateNextRetryAttempt(failureCount)

      if (nextAttempt === null) {
        // Auto-suspend after too many retries
        await subscriptionRepository.update(subscriptionId, {
          status: "suspended",
          next_renewal_attempt: null,
          suspension_date: now,
          payment_failure_count: failureCount + 1,
          updatedAt: now,
        } as any)

        // Build metadata with productData for suspension handlers (downgrade, HU sync, etc.)
        const suspendMetadata: Record<string, unknown> = {}
        if (subscription.product_id) {
          suspendMetadata.productId = subscription.product_id
        }
        try {
          if (subscription.product_id && this.deps.productRepository) {
            const suspProduct = await this.deps.productRepository.findById(subscription.product_id)
            if (suspProduct?.data) {
              const pd = typeof suspProduct.data === "string"
                ? JSON.parse(suspProduct.data)
                : suspProduct.data
              if (pd && typeof pd === "object") suspendMetadata.productData = pd
            }
            if (suspProduct?.whitelabel_code && this.deps.whitelabelRepository) {
              const behavior = await this.deps.whitelabelRepository.getSuspensionBehaviorByCode(suspProduct.whitelabel_code)
              suspendMetadata.suspensionStrategy = behavior ?? "DEACTIVATE_USER"
            }
          }
        } catch {
          /* ignore lookup errors — suspension still proceeds with defaults */
        }

        await eventBus.publish(
          SubscriptionDeactivatedEvent.create(
            {
              subscriptionId,
              userId: subscription.user_id!,
              email,
              subscriptionName: subscription.subscription_name ?? undefined,
              reason: "payment_failed",
              deactivatedBy: "system",
              previousStatus: "active",
            },
            suspendMetadata
          )
        )

        logger.info("Subscription auto-suspended after repeated payment failures", { subscriptionId })
        return
      }

      await subscriptionRepository.update(subscriptionId, {
        next_renewal_attempt: nextAttempt,
        payment_failure_count: failureCount + 1,
        updatedAt: now,
      })

      // Log failed transaction (use environment from subscription if available)
      await transactionRepository.create({
        user_id: subscription.user_id!,
        amount: subscription.amount || 0,
        type: "subscription",
        memo: `${subscription.subscription_name || "Subscription"} (failed)`,
        status: "failed",
        square_environment: subscription.square_environment || "production",
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
          productName: subscription.subscription_name ?? undefined,
          paymentType: "renewal",
          environment: subscription.square_environment || "production",
          errorMessage: error,
          errorCode: errorCode ?? "RENEWAL_ERROR",
          willRetry: true,
          nextRetryDate: nextAttempt,
          triggerSource: "cron",
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

  private calculateNextRetryAttempt(failureCount: number): Date | null {
    const today = new Date()

    if (failureCount === 0) {
      // 1st failure: retry in 1 day
      const next = new Date(today)
      next.setDate(today.getDate() + 1)
      return next
    }

    if (failureCount === 1) {
      // 2nd failure: retry in 3 days
      const next = new Date(today)
      next.setDate(today.getDate() + 3)
      return next
    }

    if (failureCount === 2) {
      // 3rd failure: retry in 7 days
      const next = new Date(today)
      next.setDate(today.getDate() + 7)
      return next
    }

    // 4th+ failure: auto-suspend
    return null
  }
}
