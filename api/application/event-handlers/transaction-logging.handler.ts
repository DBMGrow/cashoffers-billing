import { BaseEventHandler } from '@api/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { TransactionRepository } from '@api/lib/repositories'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { PaymentProcessedEvent } from '@api/domain/events/payment-processed.event'
import type { PaymentFailedEvent } from '@api/domain/events/payment-failed.event'
import type { CardCreatedEvent } from '@api/domain/events/card-created.event'
import type { CardUpdatedEvent } from '@api/domain/events/card-updated.event'

/**
 * Handles logging payment and card transactions to the database.
 * This is a CRITICAL handler - failures will cause the event processing to fail.
 *
 * Centralised transaction logging: every card charge, card create/update, and
 * payment flows through here so individual use-cases don't need to remember
 * to create transaction records.
 */
export class TransactionLoggingHandler extends BaseEventHandler {
  constructor(
    private transactionRepository: TransactionRepository,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return ['PaymentProcessed', 'PaymentFailed', 'CardCreated', 'CardUpdated']
  }

  async handle(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'PaymentProcessed':
        await this.handlePaymentProcessed(event as PaymentProcessedEvent)
        break
      case 'PaymentFailed':
        await this.handlePaymentFailed(event as PaymentFailedEvent)
        break
      case 'CardCreated':
        await this.handleCardCreated(event as CardCreatedEvent)
        break
      case 'CardUpdated':
        await this.handleCardUpdated(event as CardUpdatedEvent)
        break
      default:
        this.logger.warn('Unhandled event type in TransactionLoggingHandler', {
          eventType: event.eventType,
        })
    }
  }

  /**
   * Log successful payment to transaction table.
   * Note: In many cases, the transaction will already be created by the use case.
   * This handler serves as a fallback and for consistency.
   */
  private async handlePaymentProcessed(
    event: PaymentProcessedEvent
  ): Promise<void> {
    await this.criticalExecute(
      async () => {
        const {
          externalTransactionId,
          userId,
          amount,
          paymentType,
          productId,
          lineItems,
        } = event.payload

        this.logger.info('Logging successful payment transaction', {
          userId,
          amount,
          transactionId: event.payload.transactionId,
        })

        // Build transaction data with line items if present
        const transactionData: Record<string, unknown> = {
          paymentProvider: event.payload.paymentProvider,
          cardId: event.payload.cardId,
          cardLast4: event.payload.cardLast4,
          currency: event.payload.currency || 'USD',
        }

        if (lineItems && lineItems.length > 0) {
          transactionData.lineItems = lineItems
        }

        // Check if transaction already exists (in case use case already created it)
        const existingTransactions =
          await this.transactionRepository.findBySquareTransactionId(
            externalTransactionId
          )

        if (existingTransactions.length === 0) {
          // Create new transaction record
          const now = new Date()
          await this.transactionRepository.create({
            user_id: userId,
            square_transaction_id: externalTransactionId,
            amount,
            type: paymentType,
            status: 'success',
            product_id: productId || null,
            data: JSON.stringify(transactionData),
            memo: lineItems
              ? lineItems.map((item) => item.description).join(', ')
              : `Payment processed via ${event.payload.paymentProvider}`,
            createdAt: now,
            updatedAt: now,
          })

          this.logger.info('Transaction logged successfully', {
            userId,
            externalTransactionId,
          })
        } else {
          this.logger.debug('Transaction already exists, skipping creation', {
            userId,
            externalTransactionId,
          })
        }
      },
      event,
      'Failed to log payment transaction'
    )
  }

  /**
   * Log failed payment attempt to transaction table.
   */
  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    // Payment failures are logged but not critical - don't fail if we can't log
    await this.safeExecute(
      async () => {
        const { userId, amount, paymentType, productId, errorMessage, errorCode } =
          event.payload

        this.logger.info('Logging failed payment attempt', {
          userId,
          amount,
          errorCode,
        })

        const transactionData = {
          paymentProvider: event.payload.paymentProvider,
          cardId: event.payload.cardId,
          cardLast4: event.payload.cardLast4,
          errorMessage,
          errorCode,
          errorCategory: event.payload.errorCategory,
          attemptNumber: event.payload.attemptNumber,
        }

        const now = new Date()
        await this.transactionRepository.create({
          user_id: userId,
          square_transaction_id: null, // No transaction ID for failed payments
          amount,
          type: paymentType,
          status: 'failed',
          product_id: productId || null,
          data: JSON.stringify(transactionData),
          memo: `Payment failed: ${errorMessage}`,
          createdAt: now,
          updatedAt: now,
        })

        this.logger.info('Failed payment logged successfully', {
          userId,
        })
      },
      event,
      'Failed to log payment failure'
    )
  }

  /**
   * Log card creation to transaction table.
   * Deduplicates by checking for an existing card transaction with the same
   * externalCardId so use-cases that also create a card transaction directly
   * won't produce duplicates.
   */
  private async handleCardCreated(event: CardCreatedEvent): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { cardId, userId, email, cardLast4, cardBrand, externalCardId, environment } =
          event.payload

        this.logger.info('Logging card creation transaction', { userId, cardId })

        // Dedup: check if a card transaction for this externalCardId already exists
        const existing = await this.transactionRepository.findAll({
          type: 'card',
          user_id: userId || 0,
        })
        const alreadyLogged = existing.some((t) => {
          try {
            const data = JSON.parse(t.data ?? '{}')
            return data.cardId === externalCardId
          } catch {
            return false
          }
        })

        if (alreadyLogged) {
          this.logger.debug('Card Created transaction already exists, skipping', {
            userId,
            externalCardId,
          })
          return
        }

        const now = new Date()
        await this.transactionRepository.create({
          user_id: userId || 0,
          amount: 0,
          type: 'card',
          memo: 'Card Created',
          status: 'completed',
          square_environment: environment ?? null,
          data: JSON.stringify({
            cardId: externalCardId,
            squareCustomerId: event.metadata?.squareCustomerId,
            cardLast4,
            cardBrand,
            email,
          }),
          createdAt: now,
          updatedAt: now,
        })

        this.logger.info('Card Created transaction logged', { userId, externalCardId })
      },
      event,
      'Failed to log card creation transaction'
    )
  }

  /**
   * Log card update to transaction table.
   */
  private async handleCardUpdated(event: CardUpdatedEvent): Promise<void> {
    await this.criticalExecute(
      async () => {
        const { cardId, userId, email, cardLast4, cardBrand, externalCardId, environment, updatedFields } =
          event.payload

        this.logger.info('Logging card update transaction', { userId, cardId })

        // Dedup: check if a card-update transaction for this externalCardId already exists
        const existing = await this.transactionRepository.findAll({
          type: 'card',
          user_id: userId || 0,
        })
        const alreadyLogged = existing.some((t) => {
          try {
            const data = JSON.parse(t.data ?? '{}')
            return data.cardId === externalCardId && t.memo === 'Card Updated'
          } catch {
            return false
          }
        })

        if (alreadyLogged) {
          this.logger.debug('Card Updated transaction already exists, skipping', {
            userId,
            externalCardId,
          })
          return
        }

        const now = new Date()
        await this.transactionRepository.create({
          user_id: userId || 0,
          amount: 0,
          type: 'card',
          memo: 'Card Updated',
          status: 'completed',
          square_environment: environment ?? null,
          data: JSON.stringify({
            cardId: externalCardId,
            cardLast4,
            cardBrand,
            email,
            updatedFields,
          }),
          createdAt: now,
          updatedAt: now,
        })

        this.logger.info('Card Updated transaction logged', { userId, externalCardId })
      },
      event,
      'Failed to log card update transaction'
    )
  }
}
