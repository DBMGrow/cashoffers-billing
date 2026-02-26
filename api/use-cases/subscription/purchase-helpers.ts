import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import type {
  UserCardRepository,
  ProductRepository,
  SubscriptionRepository,
  TransactionRepository,
  PurchaseRequestRepository,
} from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { CardCreatedEvent } from "@api/domain/events/card-created.event"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"
import { PaymentProcessedEvent } from "@api/domain/events/payment-processed.event"
import { PurchaseRequestCompletedEvent } from "@api/domain/events/purchase-request-completed.event"
import type { PaymentContext } from "@api/config/config.interface"
import { ProductData, ProductUserConfig } from "@api/domain/types/product-data.types"
import { v4 as uuidv4 } from "uuid"

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseError
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown for known purchase failures. The outer catch should NOT call
 * markAsFailed for PurchaseErrors — helpers that need markAsFailed call it
 * before throwing, and helpers that don't intentionally leave the request
 * without a failure mark (preserving original behavior).
 */
export class PurchaseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = "PurchaseError"
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function parseProductId(productId: string | number): number {
  return typeof productId === "number" ? productId : parseInt(productId as string, 10)
}

export interface PurchasePricing {
  signupFee: number
  renewalCost: number
  productDuration: string
  initialAmount: number
}

export function calculatePricing(product: { price: number }, productData: ProductData): PurchasePricing {
  const signupFee = productData.signup_fee || 0
  const renewalCost = productData.renewal_cost || product.price
  const productDuration = productData.duration || "monthly"
  return { signupFee, renewalCost, productDuration, initialAmount: signupFee + renewalCost }
}

// ─────────────────────────────────────────────────────────────────────────────
// createPurchaseRequest
// ─────────────────────────────────────────────────────────────────────────────

export async function createPurchaseRequest(
  deps: { purchaseRequestRepository: PurchaseRequestRepository },
  params: { productIdNum: number; email: string; userId: number | null; input: unknown }
) {
  return deps.purchaseRequestRepository.create({
    request_uuid: uuidv4(),
    request_type: "NEW_PURCHASE",
    source: "API",
    user_id: params.userId,
    email: params.email,
    product_id: params.productIdNum,
    subscription_id: null,
    request_data: JSON.stringify(params.input),
    status: "PENDING",
    idempotency_key: null,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// validateAndParseProduct
// ─────────────────────────────────────────────────────────────────────────────

export async function validateAndParseProduct(
  deps: {
    logger: ILogger
    productRepository: ProductRepository
    purchaseRequestRepository: PurchaseRequestRepository
  },
  productIdNum: number,
  purchaseRequestId: number
) {
  const product = await deps.productRepository.findById(productIdNum)
  if (!product) {
    deps.logger.warn("Product not found", { productId: productIdNum })
    await deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, "Product not found", "PRODUCT_NOT_FOUND")
    throw new PurchaseError("Product not found", "PRODUCT_NOT_FOUND")
  }
  const productData =
    typeof product.data === "object" && product.data !== null ? (product.data as ProductData) : {}
  return { product, productData, userConfig: productData.user_config }
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveCardRecord
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveCardRecord(
  deps: {
    userCardRepository: UserCardRepository
    purchaseRequestRepository: PurchaseRequestRepository
  },
  cardIdString: string,
  purchaseRequestId: number
) {
  const userCard = await deps.userCardRepository.findOne({ card_id: cardIdString })
  if (!userCard) {
    await deps.purchaseRequestRepository.markAsFailed(purchaseRequestId, "Card not found", "CARD_NOT_FOUND")
    throw new PurchaseError("Card not found", "CARD_NOT_FOUND")
  }
  return userCard
}

// ─────────────────────────────────────────────────────────────────────────────
// processInitialPayment
// ─────────────────────────────────────────────────────────────────────────────

export async function processInitialPayment(
  deps: {
    logger: ILogger
    paymentProvider: IPaymentProvider
    purchaseRequestRepository: PurchaseRequestRepository
  },
  userCard: { card_id: string | null; square_customer_id: string | null },
  pricing: PurchasePricing,
  context: PaymentContext | null | undefined,
  purchaseRequestId: number
) {
  const payment = await deps.paymentProvider.createPayment(
    {
      sourceId: userCard.card_id!,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount: BigInt(pricing.initialAmount),
        currency: "USD",
      },
      customerId: userCard.square_customer_id || undefined,
    },
    context ?? undefined
  )

  if (payment.status !== "COMPLETED") {
    deps.logger.error("Initial payment failed", { paymentId: payment.id, status: payment.status })
    await deps.purchaseRequestRepository.markAsFailed(
      purchaseRequestId,
      `Payment failed: ${payment.status}`,
      "PAYMENT_FAILED"
    )
    throw new PurchaseError("Payment failed", "PAYMENT_FAILED")
  }

  return payment
}

// ─────────────────────────────────────────────────────────────────────────────
// createSubscriptionRecord
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubscriptionRecord(
  deps: { subscriptionRepository: SubscriptionRepository },
  params: {
    userId: number
    product: { product_id: number; product_name: string; price: number }
    pricing: PurchasePricing
    payment: { environment: "production" | "sandbox" }
    userConfig: ProductUserConfig | undefined
  }
) {
  const renewalDate = calculateRenewalDate(params.pricing.productDuration)
  const now = new Date()
  return deps.subscriptionRepository.create({
    user_id: params.userId,
    subscription_name: params.product.product_name,
    amount: params.pricing.renewalCost,
    duration: params.pricing.productDuration as "daily" | "weekly" | "monthly" | "yearly",
    status: "active",
    renewal_date: renewalDate,
    product_id: params.product.product_id,
    square_environment: params.payment.environment,
    cancel_on_renewal: 0,
    downgrade_on_renewal: 0,
    data: params.userConfig ? JSON.stringify({ user_config: params.userConfig }) : null,
    createdAt: now,
    updatedAt: now,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// createTransactionRecord
// ─────────────────────────────────────────────────────────────────────────────

export async function createTransactionRecord(
  deps: { transactionRepository: TransactionRepository },
  params: {
    userId: number
    product: { product_id: number; product_name: string }
    pricing: PurchasePricing
    payment: { id: string; environment: "production" | "sandbox" }
  }
) {
  const now = new Date()
  return deps.transactionRepository.create({
    user_id: params.userId,
    amount: params.pricing.initialAmount,
    type: "subscription",
    memo: `Subscription created: ${params.product.product_name}`,
    status: "completed",
    square_transaction_id: params.payment.id,
    square_environment: params.payment.environment,
    product_id: params.product.product_id,
    data: JSON.stringify({ signupFee: params.pricing.signupFee, renewalCost: params.pricing.renewalCost }),
    createdAt: now,
    updatedAt: now,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// publishPurchaseEvents
// ─────────────────────────────────────────────────────────────────────────────

export async function publishPurchaseEvents(
  deps: {
    eventBus: IEventBus
    purchaseRequestRepository: PurchaseRequestRepository
  },
  params: {
    purchaseRequestId: number
    purchaseRequestUuid: string
    userId: number
    email: string
    product: { product_id: number; product_name: string }
    subscription: { subscription_id: number; renewal_date: Date | null }
    transaction: { transaction_id: number }
    pricing: PurchasePricing
    payment: { id: string; environment: "production" | "sandbox" }
    cardIdString: string
    userCard: { last_4: string | null }
    userWasCreated: boolean
    startTime: Date
  }
) {
  await deps.eventBus.publish(
    SubscriptionCreatedEvent.create({
      subscriptionId: params.subscription.subscription_id,
      userId: params.userId,
      email: params.email,
      productId: params.product.product_id,
      productName: params.product.product_name,
      amount: params.pricing.renewalCost,
      initialChargeAmount: params.pricing.initialAmount,
      transactionId: params.transaction.transaction_id,
      cardId: params.cardIdString,
      userWasCreated: params.userWasCreated,
      nextRenewalDate: params.subscription.renewal_date ?? undefined,
      environment: params.payment.environment,
      source: "API",
    })
  )

  await deps.eventBus.publish(
    PaymentProcessedEvent.create({
      transactionId: params.transaction.transaction_id,
      externalTransactionId: params.payment.id,
      userId: params.userId,
      email: params.email,
      amount: params.pricing.initialAmount,
      currency: "USD",
      cardId: params.cardIdString,
      cardLast4: params.userCard.last_4 ?? undefined,
      paymentProvider: "Square",
      subscriptionId: params.subscription.subscription_id,
      productId: params.product.product_id,
      paymentType: "subscription",
      environment: params.payment.environment,
      lineItems: [
        { description: "Signup fee", amount: params.pricing.signupFee },
        { description: "First period", amount: params.pricing.renewalCost },
      ],
    })
  )

  await deps.purchaseRequestRepository.markAsCompleted(
    params.purchaseRequestId,
    {
      subscriptionId: params.subscription.subscription_id,
      transactionId: params.transaction.transaction_id,
      amountCharged: params.pricing.initialAmount,
      cardId: params.cardIdString,
    },
    params.startTime
  )

  await deps.eventBus.publish(
    PurchaseRequestCompletedEvent.create({
      purchaseRequestId: params.purchaseRequestId,
      requestUuid: params.purchaseRequestUuid,
      requestType: "NEW_PURCHASE",
      source: "API",
      userId: params.userId,
      email: params.email,
      productId: params.product.product_id,
      subscriptionId: params.subscription.subscription_id,
      transactionId: params.transaction.transaction_id,
      amountCharged: params.pricing.initialAmount,
      cardId: params.cardIdString,
      userWasCreated: params.userWasCreated,
      processingDuration: new Date().getTime() - params.startTime.getTime(),
    })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// createCardHelper (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

interface CreateCardDeps {
  logger: ILogger
  paymentProvider: IPaymentProvider
  userCardRepository: UserCardRepository
  eventBus: IEventBus
}

interface CreateCardInput {
  email: string
  cardToken: string
  expMonth: number
  expYear: number
  cardholderName: string
  context?: PaymentContext | null
}

export async function createCardHelper(
  deps: CreateCardDeps,
  userId: number | null,
  input: CreateCardInput
): Promise<{ success: boolean; cardId?: string; error?: string }> {
  const { logger, paymentProvider, userCardRepository, eventBus } = deps

  try {
    const card = await paymentProvider.createCard(
      {
        sourceId: input.cardToken,
        card: {
          cardholderName: input.cardholderName,
        },
      },
      input.context
    )

    const now = new Date()
    const userCard = await userCardRepository.create({
      user_id: userId,
      card_id: card.id,
      square_customer_id: card.id,
      square_environment: card.environment,
      card_brand: card.cardBrand,
      last_4: card.last4,
      exp_month: input.expMonth.toString(),
      exp_year: input.expYear.toString(),
      cardholder_name: input.cardholderName,
      createdAt: now,
      updatedAt: now,
    })

    await eventBus.publish(
      CardCreatedEvent.create({
        cardId: userCard.card_id,
        userId: userId || 0,
        email: input.email,
        cardLast4: card.last4 || "****",
        cardBrand: card.cardBrand,
        expirationMonth: input.expMonth,
        expirationYear: input.expYear,
        externalCardId: card.id,
        paymentProvider: "Square",
        environment: card.environment,
        isDefault: true,
      })
    )

    return { success: true, cardId: userCard.card_id }
  } catch (error) {
    logger.error("Card creation failed", { error, userId })
    return { success: false, error: error instanceof Error ? error.message : "Card creation failed" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateRenewalDate (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function calculateRenewalDate(duration: string): Date {
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
      renewalDate.setMonth(renewalDate.getMonth() + 1)
  }

  return renewalDate
}
