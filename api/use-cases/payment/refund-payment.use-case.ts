import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IUserApiClient } from "@/infrastructure/external-api/user-api.interface"
import { IConfigService } from "@/config/config.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { IRefundPaymentUseCase } from "./refund-payment.use-case.interface"
import { RefundPaymentInput, RefundPaymentOutput } from "../types/payment.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { RefundPaymentInputSchema } from "../types/validation.schemas"
import { PaymentRefundedEvent } from "@/domain/events/payment-refunded.event"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  transactionRepository: ITransactionRepository
  userApiClient: IUserApiClient
  config: IConfigService
  eventBus: IEventBus
}

/**
 * RefundPaymentUseCase
 *
 * Handles payment refunds with:
 * - Input validation
 * - Transaction lookup and validation
 * - Refund processing via Square
 * - Transaction logging (refund record + original transaction update)
 * - Email notifications (user + admin)
 * - Error handling with fallback logging
 */
export class RefundPaymentUseCase implements IRefundPaymentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: RefundPaymentInput): Promise<UseCaseResult<RefundPaymentOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = RefundPaymentInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Refund validation failed", { errors, input })
        return failure(errors, "REFUND_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Processing refund", {
        userId: validatedInput.userId,
        squareTransactionId: validatedInput.squareTransactionId,
      })

      // Find original transaction
      const transactions = await this.deps.transactionRepository.findBySquareTransactionId(
        validatedInput.squareTransactionId
      )
      if (!transactions || transactions.length === 0) {
        logger.warn("Transaction not found", {
          squareTransactionId: validatedInput.squareTransactionId,
        })
        return failure("Transaction not found", "TRANSACTION_NOT_FOUND")
      }

      const transaction = transactions[0]

      // Validate transaction is eligible for refund
      if (transaction.status === "refunded") {
        logger.warn("Transaction already refunded", {
          transactionId: transaction.transaction_id,
        })
        return failure("Transaction has already been refunded", "ALREADY_REFUNDED")
      }

      if (transaction.type !== "payment") {
        logger.warn("Cannot refund non-payment transaction", {
          transactionId: transaction.transaction_id,
          type: transaction.type,
        })
        return failure("Only payment transactions can be refunded", "INVALID_TRANSACTION_TYPE")
      }

      // Validate transaction amount
      const transactionAmount = transaction.amount || 0
      if (transactionAmount === 0) {
        logger.warn("Transaction has zero amount", {
          transactionId: transaction.transaction_id,
        })
        return failure("Cannot refund transaction with zero amount", "INVALID_AMOUNT")
      }

      // Process refund via Square (use same environment as original transaction)
      const refundResult = await this.deps.paymentProvider.refundPayment({
        paymentId: validatedInput.squareTransactionId,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(transactionAmount),
          currency: "USD",
        },
      }, input.context) // Pass context for environment selection (use input, not validatedInput)

      // Check refund status
      if (refundResult.status !== "COMPLETED" && refundResult.status !== "PENDING") {
        await this.handleFailedRefund(validatedInput, transaction)
        return failure("Refund failed", "REFUND_FAILED")
      }
      // Get user email
      let email = validatedInput.email
      if (!email) {
        const user = await this.deps.userApiClient.getUser(validatedInput.userId)
        email = user?.email || ""
      }

      if (!email) {
        logger.warn("No email found for user", { userId: validatedInput.userId })
        // Continue without email notification
      }

      // Log refund transaction
      const now = new Date()
      const refundTransaction = await this.deps.transactionRepository.create({
        user_id: validatedInput.userId,
        amount: transactionAmount,
        type: "refund",
        memo: "Refund completed",
        status: "completed",
        square_environment: refundResult.environment, // Track which Square environment was used
        data: this.serializeRefund(refundResult),
        createdAt: now,
        updatedAt: now,
      })

      // Update original transaction status
      await this.deps.transactionRepository.update(transaction.transaction_id, {
        status: "refunded",
        updatedAt: now,
      })

      logger.info("Refund completed successfully", {
        userId: validatedInput.userId,
        amount: transactionAmount,
        refundId: refundResult.id,
        duration: Date.now() - startTime,
      })

      // Publish PaymentRefundedEvent
      if (email) {
        await this.deps.eventBus.publish(
          PaymentRefundedEvent.create({
            transactionId: refundTransaction.transaction_id,
            externalRefundId: refundResult.id || "",
            originalTransactionId: transaction.transaction_id,
            externalPaymentId: validatedInput.squareTransactionId,
            userId: validatedInput.userId,
            email: email,
            amount: transactionAmount,
            currency: "USD",
            paymentProvider: "Square",
            environment: refundResult.environment, // Include environment in event
            // reason is optional and not in RefundPaymentInput
          })
        )
      }

      return success({
        refundId: refundResult.id || refundTransaction.transaction_id.toString(),
        amount: transactionAmount,
        status: refundResult.status as "completed" | "pending",
        originalTransactionId: transaction.transaction_id.toString(),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Refund processing error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      // Log failed refund
      try {
        const now = new Date()
        await this.deps.transactionRepository.create({
          user_id: input.userId,
          amount: 0,
          type: "refund",
          memo: "Refund failed",
          status: "failed",
          square_environment: input.context?.testMode ? 'sandbox' : 'production', // Track environment even on failure
          data: JSON.stringify({ error: errorMessage }),
          createdAt: now,
          updatedAt: now,
        })
      } catch (logError) {
        logger.error("Failed to log refund error", { error: logError })
      }

      // Notify admin
      await this.sendAdminErrorEmail(errorMessage)

      return failure(errorMessage, "REFUND_ERROR")
    }
  }

  private async handleFailedRefund(
    input: RefundPaymentInput,
    transaction: any
  ): Promise<void> {
    const { logger, transactionRepository } = this.deps

    // Log failed refund
    const now = new Date()
    await transactionRepository.create({
      user_id: input.userId,
      amount: transaction.amount || 0,
      type: "refund",
      memo: "Refund failed",
      status: "failed",
      square_environment: input.context?.testMode ? 'sandbox' : 'production', // Track environment even on failure
      data: JSON.stringify({ error: "Refund not completed", transactionId: transaction.transaction_id }),
      createdAt: now,
      updatedAt: now,
    })

    logger.warn("Refund failed", {
      userId: input.userId,
      transactionId: transaction.transaction_id,
    })
  }

  private async sendAdminErrorEmail(error: string): Promise<void> {
    try {
      await this.deps.emailService.sendPlainEmail({
        to: this.deps.config.get("ADMIN_EMAIL"),
        subject: "Payment Refund Error",
        text: `There was an error processing a refund: ${error}`,
      })
    } catch (emailError) {
      // Don't throw if admin email fails
      this.deps.logger.error("Failed to send admin error email", { error: emailError })
    }
  }

  private serializeRefund(refund: any): string {
    // Convert BigInt values to strings for JSON serialization
    return JSON.stringify(refund, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  }
}
