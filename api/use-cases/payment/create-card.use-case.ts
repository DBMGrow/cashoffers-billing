import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import type { UserCardRepository } from "@api/lib/repositories"
import type { TransactionRepository } from "@api/lib/repositories"
import type { SubscriptionRepository } from "@api/lib/repositories"
import { IEmailService } from "@api/infrastructure/email/email-service.interface"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { ICreateCardUseCase } from "./create-card.use-case.interface"
import { CreateCardInput, CreateCardOutput } from "../types/payment.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CreateCardInputSchema } from "../types/validation.schemas"
import { CardCreatedEvent } from "@api/domain/events/card-created.event"
import { CardUpdatedEvent } from "@api/domain/events/card-updated.event"

interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  userCardRepository: UserCardRepository
  transactionRepository: TransactionRepository
  subscriptionRepository: SubscriptionRepository
  emailService: IEmailService
  eventBus: IEventBus
}

/**
 * CreateCardUseCase
 *
 * Creates or updates a card with:
 * - Input validation
 * - Square card creation
 * - Database storage (create or update)
 * - Subscription renewal attempts
 * - Email notification
 * - Transaction logging
 */
export class CreateCardUseCase implements ICreateCardUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CreateCardInput): Promise<UseCaseResult<CreateCardOutput>> {
    const {
      logger,
      paymentProvider,
      userCardRepository,
      transactionRepository,
      subscriptionRepository,
      emailService,
    } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = CreateCardInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Create card validation failed", { errors, input })
        return failure(errors, "CREATE_CARD_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      const { userId, cardToken, expMonth, expYear, cardholderName, email, sendEmailOnUpdate = true, attemptRenewal = true } = validatedInput

      logger.info("Creating card", { userId, email })

      // Create card in Square (includes automatic customer creation)
      let cardId: string
      let squareCustomerId: string
      let last4: string
      let cardBrand: string
      let environment: 'production' | 'sandbox'
      try {
        const card = await paymentProvider.createCard({
          sourceId: cardToken,
          email: validatedInput.email,
          card: {
            cardholderName,
          },
        }, input.context) // Pass context for environment selection (use input, not validatedInput)
        cardId = card.id
        squareCustomerId = card.customerId
        last4 = card.last4 || ""
        cardBrand = card.cardBrand || ""
        environment = card.environment

        if (!cardId) {
          logger.error("Square card creation returned no ID")
          return failure("Failed to create card in payment provider", "SQUARE_CARD_CREATION_FAILED")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        logger.error("Failed to create card in Square", { error: errorMessage })
        return failure("Failed to create card in payment provider", "SQUARE_CARD_CREATION_ERROR")
      }

      // Create or update card in database
      let creatingNewCard = true
      if (userId) {
        const existingCards = await userCardRepository.findByUserId(userId)
        if (existingCards.length > 0) {
          const existingCard = existingCards[0]
          await userCardRepository.update(existingCard.id, {
            card_id: cardId,
            last_4: last4,
            card_brand: cardBrand,
            exp_month: String(expMonth),
            exp_year: String(expYear),
            cardholder_name: cardholderName,
            square_customer_id: squareCustomerId,
            square_environment: environment, // Track which Square environment was used
            updatedAt: new Date(),
          })
          creatingNewCard = false
        } else {
          await userCardRepository.create({
            user_id: userId,
            card_id: cardId,
            last_4: last4,
            card_brand: cardBrand,
            exp_month: String(expMonth),
            exp_year: String(expYear),
            cardholder_name: cardholderName,
            square_customer_id: squareCustomerId,
            square_environment: environment, // Track which Square environment was used
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      } else {
        // Create card without user_id
        await userCardRepository.create({
          user_id: null,
          card_id: cardId,
          last_4: last4,
          card_brand: cardBrand,
          exp_month: String(expMonth),
          exp_year: String(expYear),
          cardholder_name: cardholderName,
          square_customer_id: squareCustomerId,
          square_environment: environment, // Track which Square environment was used
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // Log transaction
      const now = new Date()
      await transactionRepository.create({
        user_id: userId ?? 0,
        amount: 0,
        type: "card",
        memo: creatingNewCard ? "Card Created" : "Card Updated",
        status: "completed",
        data: JSON.stringify({ cardId, squareCustomerId }),
        createdAt: now,
        updatedAt: now,
      })

      // Publish card event
      if (sendEmailOnUpdate) {
        const cardPayload = {
          cardId,
          userId: userId ?? 0,
          email,
          cardLast4: last4,
          cardBrand,
          expirationMonth: expMonth,
          expirationYear: expYear,
          externalCardId: cardId,
          paymentProvider: "Square" as const,
          environment, // Include environment in event
        }

        if (creatingNewCard) {
          await this.deps.eventBus.publish(CardCreatedEvent.create(cardPayload))
        } else {
          await this.deps.eventBus.publish(
            CardUpdatedEvent.create({
              ...cardPayload,
              updatedFields: ["card_id", "last_4", "card_brand", "exp_month", "exp_year"],
            })
          )
        }
      }

      // Optionally attempt renewal of subscriptions
      if (attemptRenewal && userId) {
        try {
          const subscriptions = await subscriptionRepository.findByUserId(userId)
          // Filter for active/suspended subscriptions due for renewal
          const dueForRenewal = subscriptions.filter(
            (sub) =>
              (sub.status === "active" || sub.status === "suspend") &&
              (!sub.renewal_date || new Date(sub.renewal_date) <= new Date())
          )

          if (dueForRenewal.length > 0) {
            logger.info("Found subscriptions to renew after card update", { count: dueForRenewal.length })
            // Note: Actual renewal handling would be done separately
            // This just logs that subscriptions exist for renewal
          }
        } catch (renewalError) {
          logger.warn("Failed to process subscription renewals after card creation", { error: renewalError })
        }
      }

      logger.info("Card created successfully", {
        cardId,
        userId,
        creatingNewCard,
        duration: Date.now() - startTime,
      })

      return success({
        cardId,
        squareCustomerId,
        last4,
        cardBrand,
        expMonth,
        expYear,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Create card error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "CREATE_CARD_ERROR")
    }
  }
}
