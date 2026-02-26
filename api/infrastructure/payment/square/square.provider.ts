import { Client, Environment, ApiError } from "square"
import { v4 as uuidv4 } from "uuid"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type {
  IPaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  CreateCardRequest,
  CardResult,
  CardInfo,
  RefundPaymentRequest,
  RefundResult,
} from "../payment-provider.interface"

/**
 * Square Payment Provider Implementation
 * Handles all Square API interactions for payments and cards
 */
export class SquarePaymentProvider implements IPaymentProvider {
  private client: Client
  private environment: "production" | "sandbox"
  private locationId: string

  constructor(
    config: IConfig,
    private logger: ILogger,
    environment: "production" | "sandbox"
  ) {
    this.environment = environment

    console.log(`Initializing SquarePaymentProvider in ${environment} environment`)

    // Use the appropriate config based on environment
    const squareConfig = environment === "production" ? config.square.production : config.square.sandbox

    console.log("Square config loaded", {
      environment,
      locationId: squareConfig.locationId ? "***" : "MISSING",
      appId: squareConfig.appId ? "***" : "MISSING",
      accessToken: squareConfig.accessToken ? "***" : "MISSING",
    })

    this.locationId = squareConfig.locationId

    this.client = new Client({
      environment: environment === "production" ? Environment.Production : Environment.Sandbox,
      accessToken: squareConfig.accessToken,
    })

    this.logger.debug(`Square payment provider initialized [${environment.toUpperCase()}]`, {
      environment,
      locationId: this.locationId,
    })
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now()
    const idempotencyKey = request.idempotencyKey || uuidv4()

    try {
      this.logger.info("Creating Square payment", {
        amount: request.amountMoney.amount.toString(),
        currency: request.amountMoney.currency,
        sourceId: request.sourceId.substring(0, 8) + "...",
        idempotencyKey,
      })

      const response = await this.client.paymentsApi.createPayment({
        sourceId: request.sourceId,
        idempotencyKey,
        amountMoney: {
          amount: request.amountMoney.amount,
          currency: request.amountMoney.currency,
        },
        locationId: request.locationId || this.locationId,
        autocomplete: true,
        customerId: request.customerId,
        acceptPartialAuthorization: false,
        note: request.note,
      })

      const payment = response.result.payment
      if (!payment) {
        throw new Error("Payment response missing payment object")
      }

      const duration = Date.now() - startTime
      this.logger.info(`Square payment created successfully [${this.environment.toUpperCase()}]`, {
        paymentId: payment.id,
        status: payment.status,
        duration,
        environment: this.environment,
      })

      return {
        id: payment.id!,
        status: payment.status!,
        amountMoney: {
          amount: BigInt(payment.amountMoney?.amount || 0),
          currency: payment.amountMoney?.currency || "USD",
        },
        createdAt: payment.createdAt!,
        receiptUrl: payment.receiptUrl,
        cardDetails: payment.cardDetails
          ? {
              card: payment.cardDetails.card
                ? {
                    last4: payment.cardDetails.card.last4!,
                    cardBrand: payment.cardDetails.card.cardBrand!,
                    expMonth: Number(payment.cardDetails.card.expMonth!),
                    expYear: Number(payment.cardDetails.card.expYear!),
                  }
                : undefined,
            }
          : undefined,
        environment: this.environment,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Square payment creation failed", error, {
        idempotencyKey,
        duration,
      })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(", ")
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async createCard(request: CreateCardRequest): Promise<CardResult> {
    const startTime = Date.now()

    try {
      this.logger.info("Creating Square card", {
        sourceId: request.sourceId.substring(0, 8) + "...",
        customerId: request.customerId,
      })

      // First, create customer if not provided
      let customerId = request.customerId
      if (!customerId) {
        const customerResponse = await this.client.customersApi.createCustomer({
          idempotencyKey: uuidv4(),
        })
        customerId = customerResponse.result.customer?.id
        if (!customerId) {
          throw new Error("Failed to create customer")
        }
        this.logger.debug("Created Square customer", { customerId })
      }

      // Create card
      const response = await this.client.cardsApi.createCard({
        idempotencyKey: uuidv4(),
        sourceId: request.sourceId,
        card: {
          customerId,
          cardholderName: request.card.cardholderName,
          billingAddress: request.card.billingAddress
            ? {
                postalCode: request.card.billingAddress.postalCode,
              }
            : undefined,
        },
      })

      const card = response.result.card
      if (!card) {
        throw new Error("Card response missing card object")
      }

      const duration = Date.now() - startTime
      this.logger.info(`Square card created successfully [${this.environment.toUpperCase()}]`, {
        cardId: card.id,
        last4: card.last4,
        duration,
        environment: this.environment,
      })

      return {
        id: card.id!,
        last4: card.last4!,
        cardBrand: card.cardBrand!,
        expMonth: Number(card.expMonth!),
        expYear: Number(card.expYear!),
        cardholderName: card.cardholderName || undefined,
        billingAddress:
          card.billingAddress && card.billingAddress.postalCode
            ? {
                postalCode: card.billingAddress.postalCode,
              }
            : undefined,
        environment: this.environment,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Square card creation failed", error, { duration })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(", ")
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async getCard(cardId: string): Promise<CardInfo> {
    try {
      this.logger.debug("Retrieving Square card", { cardId })

      const response = await this.client.cardsApi.retrieveCard(cardId)
      const card = response.result.card

      if (!card) {
        throw new Error("Card not found")
      }

      return {
        id: card.id!,
        last4: card.last4!,
        cardBrand: card.cardBrand!,
        expMonth: Number(card.expMonth!),
        expYear: Number(card.expYear!),
        enabled: card.enabled || false,
      }
    } catch (error) {
      this.logger.error("Square card retrieval failed", error, { cardId })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(", ")
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async refundPayment(request: RefundPaymentRequest): Promise<RefundResult> {
    const startTime = Date.now()
    const idempotencyKey = request.idempotencyKey || uuidv4()

    try {
      this.logger.info("Creating Square refund", {
        paymentId: request.paymentId,
        amount: request.amountMoney.amount.toString(),
        idempotencyKey,
      })

      const response = await this.client.refundsApi.refundPayment({
        idempotencyKey,
        paymentId: request.paymentId,
        amountMoney: {
          amount: request.amountMoney.amount,
          currency: request.amountMoney.currency,
        },
        reason: request.reason,
      })

      const refund = response.result.refund
      if (!refund) {
        throw new Error("Refund response missing refund object")
      }

      const duration = Date.now() - startTime
      this.logger.info(`Square refund created successfully [${this.environment.toUpperCase()}]`, {
        refundId: refund.id,
        status: refund.status,
        duration,
        environment: this.environment,
      })

      return {
        id: refund.id!,
        status: refund.status!,
        amountMoney: {
          amount: BigInt(refund.amountMoney?.amount || 0),
          currency: refund.amountMoney?.currency || "USD",
        },
        createdAt: refund.createdAt!,
        environment: this.environment,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Square refund creation failed", error, {
        paymentId: request.paymentId,
        duration,
      })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(", ")
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }
}

/**
 * Create a Square payment provider
 */
export const createSquarePaymentProvider = (
  config: IConfig,
  logger: ILogger,
  environment: "production" | "sandbox"
): IPaymentProvider => {
  return new SquarePaymentProvider(config, logger, environment)
}
