import fetch from "node-fetch"
import { ILogger } from "@/infrastructure/logging/logger.interface"
import { IPaymentProvider, CreatePaymentRequest } from "@/infrastructure/payment/payment-provider.interface"
import { IEmailService } from "@/infrastructure/email/email-service.interface"
import { ITransactionRepository } from "@/infrastructure/database/repositories/transaction.repository.interface"
import { IProductRepository } from "@/infrastructure/database/repositories/product.repository.interface"
import { IConfigService } from "@/config/config.interface"
import { IEventBus } from "@/infrastructure/events/event-bus.interface"
import { IUnlockPropertyUseCase } from "./unlock-property.use-case.interface"
import { UnlockPropertyInput, UnlockPropertyOutput } from "../types/property.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { UnlockPropertyInputSchema } from "../types/validation.schemas"
import { PropertyUnlockedEvent } from "@/domain/events/property-unlocked.event"
import { v4 as uuidv4 } from "uuid"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  transactionRepository: ITransactionRepository
  productRepository: IProductRepository
  config: IConfigService
  eventBus: IEventBus
}

/**
 * UnlockPropertyUseCase
 *
 * Orchestrates property unlock with payment processing:
 * - Validates property and card token
 * - Charges $50 via Square API
 * - Updates property unlock status
 * - **CRITICAL:** Automatically refunds payment if property update fails
 * - Logs all transactions
 * - Sends confirmation/error emails
 */
export class UnlockPropertyUseCase implements IUnlockPropertyUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: UnlockPropertyInput): Promise<UseCaseResult<UnlockPropertyOutput>> {
    const { logger } = this.deps
    const startTime = Date.now()

    try {
      // 1. Validate input with Zod
      const validationResult = UnlockPropertyInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Property unlock validation failed", { errors, input })
        return failure(errors, "PROPERTY_UNLOCK_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Processing property unlock", {
        propertyToken: validatedInput.propertyToken,
        userId: validatedInput.userId,
      })

      // 2. Fetch property from external API
      const property = await this.fetchProperty(validatedInput.propertyToken)
      if (!property) {
        logger.warn("Property not found", { propertyToken: validatedInput.propertyToken })
        return failure("Property not found", "PROPERTY_NOT_FOUND")
      }

      // 3. Find "Property Unlock" product
      const product = await this.deps.productRepository.findByName("Property Unlock")
      if (!product) {
        logger.error("Property Unlock product not found")
        return failure("Property Unlock product not found in system", "PRODUCT_NOT_FOUND")
      }

      const amount = 5000 // $50 in cents
      const propertyAddress = this.formatPropertyAddress(property)

      // 4. Process payment via Square
      logger.info("Creating payment for property unlock", {
        userId: validatedInput.userId,
        amount,
      })

      const paymentRequest: CreatePaymentRequest = {
        sourceId: validatedInput.cardToken,
        idempotencyKey: uuidv4(),
        amountMoney: {
          amount: BigInt(amount),
          currency: "USD",
        },
      }

      const payment = await this.deps.paymentProvider.createPayment(paymentRequest)

      // Check payment status
      if (payment.status !== "COMPLETED") {
        logger.warn("Payment not completed", { paymentId: payment.id || "unknown" })
        return failure("Payment failed. Please try again.", "PAYMENT_FAILED")
      }

      const paymentId = payment.id || "unknown"

      // 5. Update property with CRITICAL ROLLBACK on failure
      try {
        logger.info("Updating property status", {
          propertyToken: validatedInput.propertyToken,
          paymentId,
        })

        await this.updateProperty(validatedInput.propertyToken)
      } catch (updateError) {
        const errorMessage = updateError instanceof Error ? updateError.message : "Unknown error"

        // CRITICAL: Automatic refund if property update fails
        logger.error("Property unlock failed, initiating automatic refund", {
          propertyToken: validatedInput.propertyToken,
          paymentId,
          error: errorMessage,
        })

        try {
          await this.deps.paymentProvider.refundPayment({
            paymentId,
            amountMoney: {
              amount: BigInt(amount),
              currency: "USD",
            },
            idempotencyKey: uuidv4(),
            reason: "Property unlock failed - automatic refund",
          })
          logger.info("Automatic refund completed", { paymentId })
        } catch (refundError) {
          const refundErrorMessage = refundError instanceof Error ? refundError.message : "Unknown error"
          logger.error("Automatic refund FAILED - manual intervention required", {
            paymentId,
            propertyToken: validatedInput.propertyToken,
            refundError: refundErrorMessage,
          })

          // Notify admin of critical refund failure
          await this.sendAdminCriticalErrorEmail(paymentId, validatedInput.propertyToken, refundErrorMessage)
        }

        // Notify admin of property unlock failure
        await this.sendAdminPropertyUpdateErrorEmail(
          validatedInput.propertyToken,
          propertyAddress,
          paymentId,
          errorMessage
        )

        return failure(
          "Property unlock failed. Your payment has been refunded. Please contact support.",
          "PROPERTY_UNLOCK_FAILED"
        )
      }

      // 6. Log transaction
      const now = new Date()
      const transaction = await this.deps.transactionRepository.create({
        user_id: validatedInput.userId,
        amount,
        type: "property_unlock",
        memo: `Property unlock: ${propertyAddress}`,
        status: "completed",
        square_transaction_id: paymentId,
        data: this.serializePayment(payment),
        createdAt: now,
        updatedAt: now,
      })

      logger.info("Property unlock transaction logged", {
        transactionId: transaction.transaction_id,
        paymentId,
      })

      // 7. Publish PropertyUnlockedEvent
      await this.deps.eventBus.publish(
        PropertyUnlockedEvent.create({
          transactionId: transaction.transaction_id,
          userId: validatedInput.userId,
          email: validatedInput.email,
          propertyId: property?.id || 0,
          propertyAddress,
          amount,
          currency: "USD",
          externalTransactionId: paymentId,
          paymentProvider: "Square",
          productId: product.product_id,
          productName: product.product_name,
        })
      )

      logger.info("Property unlocked successfully", {
        propertyToken: validatedInput.propertyToken,
        userId: validatedInput.userId,
        transactionId: transaction.transaction_id,
        duration: Date.now() - startTime,
      })

      return success({
        propertyToken: validatedInput.propertyToken,
        propertyAddress,
        transactionId: transaction.transaction_id.toString(),
        squarePaymentId: paymentId,
        amount,
        unlocked: true,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Property unlock error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      // Notify admin of unexpected error
      await this.sendAdminErrorEmail(errorMessage)

      return failure(errorMessage, "PROPERTY_UNLOCK_ERROR")
    }
  }

  private async sendAdminPropertyUpdateErrorEmail(
    propertyToken: string,
    propertyAddress: string,
    paymentId: string,
    error: string
  ): Promise<void> {
    try {
      await this.deps.emailService.sendPlainEmail({
        to: this.deps.config.get("ADMIN_EMAIL"),
        subject: "Property Unlock Failure - Payment Refunded",
        text: `Property unlock failed for ${propertyAddress} (${propertyToken})\n\nPayment ${paymentId} was automatically refunded.\n\nError: ${error}`,
      })
    } catch (emailError) {
      this.deps.logger.error("Failed to send admin property update error email", { error: emailError })
    }
  }

  private async sendAdminCriticalErrorEmail(
    paymentId: string,
    propertyToken: string,
    refundError: string
  ): Promise<void> {
    try {
      await this.deps.emailService.sendPlainEmail({
        to: this.deps.config.get("ADMIN_EMAIL"),
        subject: "CRITICAL: Property Unlock Refund Failed - Manual Intervention Required",
        text: `CRITICAL ERROR: Automatic refund failed for property unlock\n\nPayment ID: ${paymentId}\nProperty Token: ${propertyToken}\n\nRefund Error: ${refundError}\n\nManual intervention required to issue refund.`,
      })
    } catch (emailError) {
      this.deps.logger.error("Failed to send admin critical error email", { error: emailError })
    }
  }

  private async sendAdminErrorEmail(error: string): Promise<void> {
    try {
      await this.deps.emailService.sendPlainEmail({
        to: this.deps.config.get("ADMIN_EMAIL"),
        subject: "Property Unlock Error",
        text: `There was an error processing a property unlock: ${error}`,
      })
    } catch (emailError) {
      this.deps.logger.error("Failed to send admin error email", { error: emailError })
    }
  }

  private formatPropertyAddress(property: any): string {
    const address1 = property?.address1 || ""
    const city = property?.city || ""
    const state = property?.state || ""

    const parts = [address1, city, state].filter(Boolean)
    return parts.join(", ") || "Unknown Property"
  }

  private serializePayment(payment: any): string {
    // Convert BigInt values to strings for JSON serialization
    return JSON.stringify(payment, (key, value) => (typeof value === "bigint" ? value.toString() : value))
  }

  private async fetchProperty(propertyToken: string): Promise<any> {
    const apiUrl = this.deps.config.get("API_URL")
    const apiToken = this.deps.config.get("API_MASTER_TOKEN")

    try {
      const response = await fetch(`${apiUrl}/properties/${propertyToken}/full`, {
        headers: {
          "x-api-token": apiToken,
        },
      })

      const data = await response.json()

      if (!data?.success) {
        throw new Error("Property API returned error: " + JSON.stringify(data))
      }

      return data?.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      this.deps.logger.error("Failed to fetch property", { propertyToken, error: errorMessage })
      throw error
    }
  }

  private async updateProperty(propertyToken: string): Promise<void> {
    const apiUrl = this.deps.config.get("API_URL")
    const apiToken = this.deps.config.get("API_MASTER_TOKEN")

    try {
      const response = await fetch(`${apiUrl}/properties/${propertyToken}/full`, {
        method: "PUT",
        headers: {
          "x-api-token": apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_unlocked: 2 }),
      })

      const data = await response.json()

      if (!data?.success) {
        throw new Error("Property API returned error: " + JSON.stringify(data))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      this.deps.logger.error("Failed to update property", { propertyToken, error: errorMessage })
      throw error
    }
  }
}
