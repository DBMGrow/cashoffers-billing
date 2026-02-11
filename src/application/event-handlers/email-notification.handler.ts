import { BaseEventHandler } from '@/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@/infrastructure/events/event-bus.interface'
import type { IEmailService } from '@/infrastructure/email/email-service.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { SubscriptionCreatedEvent } from '@/domain/events/subscription-created.event'
import type { SubscriptionRenewedEvent } from '@/domain/events/subscription-renewed.event'
import type { PaymentProcessedEvent } from '@/domain/events/payment-processed.event'
import type { PaymentFailedEvent } from '@/domain/events/payment-failed.event'
import type { PaymentRefundedEvent } from '@/domain/events/payment-refunded.event'
import type { CardCreatedEvent } from '@/domain/events/card-created.event'
import type { CardUpdatedEvent } from '@/domain/events/card-updated.event'
import type { PropertyUnlockedEvent } from '@/domain/events/property-unlocked.event'
import type { SubscriptionDeactivatedEvent } from '@/domain/events/subscription-deactivated.event'
import type { SubscriptionPausedEvent } from '@/domain/events/subscription-paused.event'
import type { SubscriptionCancelledEvent } from '@/domain/events/subscription-cancelled.event'
import type { SubscriptionDowngradedEvent } from '@/domain/events/subscription-downgraded.event'

/**
 * Handles sending email notifications in response to domain events.
 * Email failures are logged but don't fail the event processing (non-critical).
 */
export class EmailNotificationHandler extends BaseEventHandler {
  constructor(
    private emailService: IEmailService,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    return [
      'SubscriptionCreated',
      'SubscriptionRenewed',
      'PaymentProcessed',
      'PaymentFailed',
      'PaymentRefunded',
      'CardCreated',
      'CardUpdated',
      'PropertyUnlocked',
      'SubscriptionDeactivated',
      'SubscriptionPaused',
      'SubscriptionCancelled',
      'SubscriptionDowngraded',
    ]
  }

  async handle(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'SubscriptionCreated':
        await this.handleSubscriptionCreated(event as SubscriptionCreatedEvent)
        break
      case 'SubscriptionRenewed':
        await this.handleSubscriptionRenewed(event as SubscriptionRenewedEvent)
        break
      case 'PaymentProcessed':
        await this.handlePaymentProcessed(event as PaymentProcessedEvent)
        break
      case 'PaymentFailed':
        await this.handlePaymentFailed(event as PaymentFailedEvent)
        break
      case 'PaymentRefunded':
        await this.handlePaymentRefunded(event as PaymentRefundedEvent)
        break
      case 'CardCreated':
        await this.handleCardCreated(event as CardCreatedEvent)
        break
      case 'CardUpdated':
        await this.handleCardUpdated(event as CardUpdatedEvent)
        break
      case 'PropertyUnlocked':
        await this.handlePropertyUnlocked(event as PropertyUnlockedEvent)
        break
      case 'SubscriptionDeactivated':
        await this.handleSubscriptionDeactivated(event as SubscriptionDeactivatedEvent)
        break
      case 'SubscriptionPaused':
        await this.handleSubscriptionPaused(event as SubscriptionPausedEvent)
        break
      case 'SubscriptionCancelled':
        await this.handleSubscriptionCancelled(event as SubscriptionCancelledEvent)
        break
      case 'SubscriptionDowngraded':
        await this.handleSubscriptionDowngraded(event as SubscriptionDowngradedEvent)
        break
      default:
        this.logger.warn('Unhandled event type in EmailNotificationHandler', {
          eventType: event.eventType,
        })
    }
  }

  private async handleSubscriptionCreated(
    event: SubscriptionCreatedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, productName, amount, initialChargeAmount } = event.payload

        this.logger.info('Sending subscription created email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Welcome to CashOffers!',
          template: 'subscriptionCreated.html',
          fields: {
            productName,
            amount: (initialChargeAmount || amount) / 100,
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription created email'
    )
  }

  private async handleSubscriptionRenewed(
    event: SubscriptionRenewedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, productName, amount, nextRenewalDate } = event.payload

        this.logger.info('Sending subscription renewal email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your CashOffers Subscription Has Been Renewed',
          template: 'subscriptionRenewal.html',
          fields: {
            productName,
            amount: amount / 100,
            nextRenewalDate: nextRenewalDate?.toISOString(),
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription renewal email'
    )
  }

  private async handlePaymentProcessed(
    event: PaymentProcessedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount, externalTransactionId, paymentType, lineItems } = event.payload

        // Only send email for one-time payments (subscriptions are handled separately)
        if (paymentType !== 'one-time' && paymentType !== 'unlock') {
          return
        }

        this.logger.info('Sending payment confirmation email', {
          email,
          transactionId: event.payload.transactionId,
          paymentType,
        })

        const memo = lineItems && lineItems.length > 0 ? lineItems[0].description : ''

        await this.emailService.sendEmail({
          to: email,
          subject: 'Payment Successful',
          template: 'paymentConfirm.html',
          fields: {
            amount: amount / 100,
            transactionID: externalTransactionId,
            date: new Date().toLocaleDateString(),
            memo: memo,
          },
        })
      },
      event,
      'Failed to send payment confirmation email'
    )
  }

  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount, errorMessage, willRetry, nextRetryDate } =
          event.payload

        this.logger.info('Sending payment failed email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Payment Failed - Action Required',
          template: 'subscriptionRenewalFailed.html',
          fields: {
            amount: amount / 100,
            errorMessage,
            willRetry,
            nextRetryDate: nextRetryDate?.toISOString(),
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send payment failed email'
    )
  }

  private async handlePaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount } = event.payload

        this.logger.info('Sending payment refunded email', {
          email,
          transactionId: event.payload.transactionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Payment Refunded',
          template: 'refund.html',
          fields: {
            amount: amount / 100,
            date: new Date().toLocaleDateString(),
          },
        })
      },
      event,
      'Failed to send payment refunded email'
    )
  }

  private async handleCardCreated(event: CardCreatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, cardLast4 } = event.payload

        this.logger.info('Sending card created email', {
          email,
          cardId: event.payload.cardId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'A Card Was Added to Your Account',
          template: 'cardUpdated.html',
          fields: {
            message: `A Card ending in ${cardLast4} was added to your account`,
            card: `**** **** **** ${cardLast4}`,
            date: new Date().toLocaleDateString(),
          },
        })
      },
      event,
      'Failed to send card created email'
    )
  }

  private async handleCardUpdated(event: CardUpdatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, cardLast4 } = event.payload

        this.logger.info('Sending card updated email', {
          email,
          cardId: event.payload.cardId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'The Card on Your Account Was Updated',
          template: 'cardUpdated.html',
          fields: {
            message: `The Card linked to your account was updated and now ends in ${cardLast4}`,
            card: `**** **** **** ${cardLast4}`,
            date: new Date().toLocaleDateString(),
          },
        })
      },
      event,
      'Failed to send card updated email'
    )
  }

  private async handlePropertyUnlocked(event: PropertyUnlockedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, propertyAddress, amount, externalTransactionId } = event.payload

        this.logger.info('Sending property unlocked email', {
          email,
          propertyId: event.payload.propertyId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Property Unlocked',
          template: 'propertyUnlocked.html',
          fields: {
            propertyAddress: propertyAddress || 'Unknown Property',
            amount: amount / 100,
            transactionID: externalTransactionId,
            date: new Date().toLocaleDateString(),
          },
        })
      },
      event,
      'Failed to send property unlocked email'
    )
  }

  private async handleSubscriptionDeactivated(
    event: SubscriptionDeactivatedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName, reason } = event.payload

        // Only send email if we have the user's email
        if (!email) {
          this.logger.debug('No email provided for subscription deactivation notification', {
            subscriptionId: event.payload.subscriptionId,
          })
          return
        }

        this.logger.info('Sending subscription deactivated email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Has Been Deactivated',
          template: 'subscriptionCancelled.html',
          fields: {
            subscription: subscriptionName || 'Subscription',
            reason: reason || 'deactivated',
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription deactivated email'
    )
  }

  private async handleSubscriptionPaused(
    event: SubscriptionPausedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName, reason } = event.payload

        if (!email) {
          this.logger.debug('No email provided for subscription pause notification', {
            subscriptionId: event.payload.subscriptionId,
          })
          return
        }

        this.logger.info('Sending subscription paused email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Has Been Paused',
          template: 'subscriptionCancelled.html',
          fields: {
            subscription: subscriptionName || 'Subscription',
            reason: reason || 'paused',
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription paused email'
    )
  }

  private async handleSubscriptionCancelled(
    event: SubscriptionCancelledEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName, effectiveDate, cancelOnRenewal } = event.payload

        if (!email) {
          this.logger.debug('No email provided for subscription cancellation notification', {
            subscriptionId: event.payload.subscriptionId,
          })
          return
        }

        this.logger.info('Sending subscription cancelled email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Will Be Cancelled',
          template: 'subscriptionCancelled.html',
          fields: {
            subscription: subscriptionName || 'Subscription',
            effectiveDate: effectiveDate?.toLocaleDateString() || 'next renewal',
            cancelOnRenewal: cancelOnRenewal ? 'true' : 'false',
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription cancelled email'
    )
  }

  private async handleSubscriptionDowngraded(
    event: SubscriptionDowngradedEvent
  ): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, currentSubscriptionName, targetProductName, effectiveDate } = event.payload

        if (!email) {
          this.logger.debug('No email provided for subscription downgrade notification', {
            subscriptionId: event.payload.subscriptionId,
          })
          return
        }

        this.logger.info('Sending subscription downgraded email', {
          email,
          subscriptionId: event.payload.subscriptionId,
        })

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Will Be Downgraded',
          template: 'subscriptionCancelled.html',
          fields: {
            subscription: currentSubscriptionName || 'Subscription',
            targetProduct: targetProductName || 'lower tier',
            effectiveDate: effectiveDate?.toLocaleDateString() || 'next renewal',
            subscriptionId: event.payload.subscriptionId,
          },
        })
      },
      event,
      'Failed to send subscription downgraded email'
    )
  }
}
