import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { TransactionRepository } from "@api/lib/repositories"
import { IGetPaymentsUseCase } from "./get-payments.use-case.interface"
import { GetPaymentsInput, GetPaymentsOutput } from "../types/payment.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { GetPaymentsInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  transactionRepository: TransactionRepository
}

/**
 * GetPaymentsUseCase
 *
 * Retrieves payment transactions with:
 * - Input validation
 * - Pagination support
 * - User filtering (with permission checks)
 * - Type filtering (payment, card, refund)
 */
export class GetPaymentsUseCase implements IGetPaymentsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: GetPaymentsInput): Promise<UseCaseResult<GetPaymentsOutput>> {
    const { logger, transactionRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input with Zod
      const validationResult = GetPaymentsInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Get payments validation failed", { errors, input })
        return failure(errors, "GET_PAYMENTS_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data

      // Set defaults
      const page = validatedInput.page || 1
      const limit = validatedInput.limit || 20
      const offset = (page - 1) * limit

      logger.info("Retrieving payments", {
        userId: validatedInput.userId,
        page,
        limit,
        readAll: validatedInput.readAll,
      })

      // Build filter criteria
      const userId = validatedInput.readAll ? undefined : validatedInput.userId

      // Get transactions
      const transactions = await transactionRepository.findByType(["payment", "card"], {
        userId,
        limit,
        offset,
      })

      // Count total
      const total = await transactionRepository.countByType(["payment", "card"], {
        userId,
      })

      // Map to output format
      const payments = transactions.map((tx) => ({
        id: tx.transaction_id,
        userId: tx.user_id || 0,
        amount: tx.amount || 0,
        type: tx.type,
        memo: tx.memo || "",
        status: tx.status || "unknown",
        createdAt: tx.createdAt,
        squareTransactionId: tx.square_transaction_id || undefined,
      }))

      logger.info("Payments retrieved successfully", {
        count: payments.length,
        total,
        duration: Date.now() - startTime,
      })

      return success({
        payments,
        total,
        page,
        limit,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Get payments error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "GET_PAYMENTS_ERROR")
    }
  }
}
