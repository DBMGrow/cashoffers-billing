import { ILogger } from "@api/infrastructure/logging/logger.interface"
import { IPaymentProvider } from "@api/infrastructure/payment/payment-provider.interface"
import type { UserCardRepository } from "@api/lib/repositories"
import { IEventBus } from "@api/infrastructure/events/event-bus.interface"
import { CardCreatedEvent } from "@api/domain/events/card-created.event"
import type { PaymentContext } from "@api/config/config.interface"

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
