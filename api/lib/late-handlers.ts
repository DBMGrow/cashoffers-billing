/**
 * Late handler registrations
 *
 * These handlers depend on use cases (which depend on services),
 * so they must be registered after both layers are initialized
 * to avoid circular imports.
 */
import { eventBus, logger } from "@api/lib/services"
import { subscriptionRepository } from "@api/lib/repositories"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"
import { CardUpdatedRetryHandler } from "@api/application/event-handlers/card-updated-retry.handler"

const cardUpdatedRetryHandler = new CardUpdatedRetryHandler({
  logger,
  subscriptionRepository,
  renewSubscriptionUseCase,
})

eventBus.subscribe("CardUpdated", cardUpdatedRetryHandler)
