import { Client, Environment, ApiError } from 'square'
import { v4 as uuidv4 } from 'uuid'
import type { IConfig } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type {
  IPaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  CreateCardRequest,
  CardResult,
  CardInfo,
  RefundPaymentRequest,
  RefundResult,
} from '../payment-provider.interface'

/**
 * Square Payment Provider Implementation
 * Handles all Square API interactions for payments and cards
 */
export class SquarePaymentProvider implements IPaymentProvider {
  private client: Client

  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    this.client = new Client({
      environment:
        config.square.environment === 'production' ? Environment.Production : Environment.Sandbox,
      accessToken: config.square.accessToken,
    })

    this.logger.debug('Square payment provider initialized', {
      environment: config.square.environment,
    })
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now()
    const idempotencyKey = request.idempotencyKey || uuidv4()

    try {
      this.logger.info('Creating Square payment', {
        amount: request.amountMoney.amount.toString(),
        currency: request.amountMoney.currency,
        sourceId: request.sourceId.substring(0, 8) + '...',
        idempotencyKey,
      })

      const response = await this.client.paymentsApi.createPayment({
        sourceId: request.sourceId,
        idempotencyKey,
        amountMoney: {
          amount: request.amountMoney.amount,
          currency: request.amountMoney.currency,
        },
        locationId: request.locationId || this.config.square.locationId,
        autocomplete: true,
        customerId: request.customerId,
        acceptPartialAuthorization: false,
        note: request.note,
      })

      const payment = response.result.payment
      if (!payment) {
        throw new Error('Payment response missing payment object')
      }

      const duration = Date.now() - startTime
      this.logger.info('Square payment created successfully', {
        paymentId: payment.id,
        status: payment.status,
        duration,
      })

      return {
        id: payment.id!,
        status: payment.status!,
        amountMoney: {
          amount: BigInt(payment.amountMoney?.amount || 0),
          currency: payment.amountMoney?.currency || 'USD',
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
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Square payment creation failed', error, {
        idempotencyKey,
        duration,
      })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(', ')
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async createCard(request: CreateCardRequest): Promise<CardResult> {
    const startTime = Date.now()

    try {
      this.logger.info('Creating Square card', {
        sourceId: request.sourceId.substring(0, 8) + '...',
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
          throw new Error('Failed to create customer')
        }
        this.logger.debug('Created Square customer', { customerId })
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
        throw new Error('Card response missing card object')
      }

      const duration = Date.now() - startTime
      this.logger.info('Square card created successfully', {
        cardId: card.id,
        last4: card.last4,
        duration,
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
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Square card creation failed', error, { duration })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(', ')
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async getCard(cardId: string): Promise<CardInfo> {
    try {
      this.logger.debug('Retrieving Square card', { cardId })

      const response = await this.client.cardsApi.retrieveCard(cardId)
      const card = response.result.card

      if (!card) {
        throw new Error('Card not found')
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
      this.logger.error('Square card retrieval failed', error, { cardId })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(', ')
        throw new Error(`Square API error: ${errorMessages}`)
      }

      throw error
    }
  }

  async refundPayment(request: RefundPaymentRequest): Promise<RefundResult> {
    const startTime = Date.now()
    const idempotencyKey = request.idempotencyKey || uuidv4()

    try {
      this.logger.info('Creating Square refund', {
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
        throw new Error('Refund response missing refund object')
      }

      const duration = Date.now() - startTime
      this.logger.info('Square refund created successfully', {
        refundId: refund.id,
        status: refund.status,
        duration,
      })

      return {
        id: refund.id!,
        status: refund.status!,
        amountMoney: {
          amount: BigInt(refund.amountMoney?.amount || 0),
          currency: refund.amountMoney?.currency || 'USD',
        },
        createdAt: refund.createdAt!,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Square refund creation failed', error, {
        paymentId: request.paymentId,
        duration,
      })

      if (error instanceof ApiError) {
        const errors = error.result?.errors || []
        const errorMessages = errors.map((e: any) => `${e.code}: ${e.detail}`).join(', ')
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
  logger: ILogger
): IPaymentProvider => {
  return new SquarePaymentProvider(config, logger)
}
