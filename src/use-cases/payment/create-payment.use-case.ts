import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { IUserCardRepository } from "@/infrastructure/database/repositories/user-card.repository.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IConfigService } from "@/config/config.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { ICreatePaymentUseCase } from "./create-payment.use-case.interface"
import { CreatePaymentInput, CreatePaymentOutput } from "../types/payment.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CreatePaymentInputSchema } from "../types/validation.schemas"
import { PaymentProcessedEvent } from "@/domain/events/payment-processed.event"
import { PaymentFailedEvent } from "@/domain/events/payment-failed.event"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userCardRepository: IUserCardRepository
  transactionRepository: ITransactionRepository
  config: IConfigService
  eventBus: IEventBus
}

/**
 * CreatePaymentUseCase
 *
 * Handles one-time payment processing with:
 * - Input validation
 * - Card lookup from database
 * - Payment processing via Square
 * - Transaction logging
 * - Email notifications (success/failure)
 * - Admin error notifications
 */
export class CreatePaymentUseCase implements ICreatePaymentUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CreatePaymentInput): Promise<UseCaseResult<CreatePaymentOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = CreatePaymentInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Payment validation failed", { errors, input })
        return failure(errors, "PAYMENT_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Processing payment", {
        userId: validatedInput.userId,
        amount: validatedInput.amount,
      })

      // Get user's card
      const userCards = await this.deps.userCardRepository.findByUserId(validatedInput.userId)
      if (!userCards || userCards.length === 0) {
        logger.warn("No card found for user", { userId: validatedInput.userId })
        return failure("No card found", "NO_CARD_FOUND")
      }

      const userCard = userCards[0] // Use first card
      if (!userCard.card_id || !userCard.square_customer_id) {
        logger.warn("Incomplete card data", { userId: validatedInput.userId })
        return failure("Card information incomplete", "INCOMPLETE_CARD_DATA")
      }

      // Create payment via Square
      const payment = await this.deps.paymentProvider.createPayment({
        sourceId: userCard.card_id,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(validatedInput.amount),
          currency: "USD",
        },
        customerId: userCard.square_customer_id,
      })

      // Check payment status
      if (payment.status !== "COMPLETED") {
        await this.handleFailedPayment(validatedInput, payment.id || "unknown")
        return failure("Payment failed", "PAYMENT_FAILED")
      }

      // Log successful transaction
      const now = new Date()
      const transaction = await this.deps.transactionRepository.create({
        user_id: validatedInput.userId,
        amount: validatedInput.amount,
        type: "payment",
        memo: validatedInput.memo,
        status: "completed",
        square_transaction_id: payment.id,
        data: this.serializePayment(payment),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Payment completed successfully", {
        userId: validatedInput.userId,
        amount: validatedInput.amount,
        transactionId: transaction.transaction_id,
        squarePaymentId: payment.id,
        duration: Date.now() - startTime,
      })

      // Publish PaymentProcessedEvent
      if (validatedInput.sendEmailOnCharge !== false) {
        await this.deps.eventBus.publish(
          PaymentProcessedEvent.create({
            transactionId: transaction.transaction_id,
            externalTransactionId: payment.id || "",
            userId: validatedInput.userId,
            email: validatedInput.email,
            amount: validatedInput.amount,
            currency: "USD",
            cardId: userCard.card_id || undefined,
            cardLast4: userCard.last_four || undefined,
            paymentProvider: "Square",
            paymentType: "one-time",
            lineItems: validatedInput.memo ? [{
              description: validatedInput.memo,
              amount: validatedInput.amount
            }] : undefined,
          })
        )
      }

      return success({
        transactionId: transaction.transaction_id.toString(),
        squarePaymentId: payment.id || "",
        amount: validatedInput.amount,
        status: "completed",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Payment processing error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      // Notify admin
      await this.sendAdminErrorEmail(errorMessage)

      return failure(errorMessage, "PAYMENT_ERROR")
    }
  }

  private async handleFailedPayment(input: CreatePaymentInput, paymentId: string): Promise<void> {
    const { logger, transactionRepository, eventBus } = this.deps

    // Log failed transaction
    const now = new Date()
    const transaction = await transactionRepository.create({
      user_id: input.userId,
      amount: input.amount,
      type: "payment",
      memo: "Payment failed",
      status: "failed",
      square_transaction_id: paymentId,
      data: JSON.stringify({ error: "Payment not completed", paymentId }),
      createdAt: now,
      updatedAt: now,
    })

    // Publish PaymentFailedEvent
    await eventBus.publish(
      PaymentFailedEvent.create({
        transactionId: transaction.transaction_id,
        externalTransactionId: paymentId,
        userId: input.userId,
        email: input.email,
        amount: input.amount,
        currency: "USD",
        errorMessage: "Payment not completed",
        paymentProvider: "Square",
        paymentType: "one-time",
        willRetry: false,
      })
    )

    logger.warn("Payment failed, user notified", {
      userId: input.userId,
      amount: input.amount,
      paymentId,
    })
  }

  private async sendAdminErrorEmail(error: string): Promise<void> {
    try {
      await this.deps.emailService.sendPlainEmail({
        to: this.deps.config.get("ADMIN_EMAIL"),
        subject: "Payment Error",
        text: `There was an error processing a payment: ${error}`,
      })
    } catch (emailError) {
      // Don't throw if admin email fails
      this.deps.logger.error("Failed to send admin error email", { error: emailError })
    }
  }

  private serializePayment(payment: any): string {
    // Convert BigInt values to strings for JSON serialization
    return JSON.stringify(payment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  }
}
