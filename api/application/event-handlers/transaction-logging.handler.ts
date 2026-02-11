import { BaseEventHandler } from '@/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'
import type { ITransactionRepository } from '@/infrastructure/database/repositories/transaction.repository.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { PaymentProcessedEvent } from '@/domain/events/payment-processed.event'
import type { PaymentFailedEvent } from '@/domain/events/payment-failed.event'

/**
 * Handles logging payment transactions to the database.
 * This is a CRITICAL handler - failures will cause the event processing to fail.
 */
export class TransactionLoggingHandler extends BaseEventHandler {
  constructor(
    private transactionRepository: ITransactionRepository,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return ['PaymentProcessed', 'PaymentFailed']
  }

  async handle(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'PaymentProcessed':
        await this.handlePaymentProcessed(event as PaymentProcessedEvent)
        break
      case 'PaymentFailed':
        await this.handlePaymentFailed(event as PaymentFailedEvent)
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
}
