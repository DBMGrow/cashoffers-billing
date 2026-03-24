import { render } from '@react-email/render'
import { BaseEventHandler } from '@api/infrastructure/events/base-event-handler'
import type { IDomainEvent } from '@api/infrastructure/events/event-bus.interface'
import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import { whitelabelResolverService } from '@api/lib/services'
import type { SubscriptionCreatedEvent } from '@api/domain/events/subscription-created.event'
import type { SubscriptionRenewedEvent } from '@api/domain/events/subscription-renewed.event'
import type { PaymentProcessedEvent } from '@api/domain/events/payment-processed.event'
import type { PaymentFailedEvent } from '@api/domain/events/payment-failed.event'
import type { PaymentRefundedEvent } from '@api/domain/events/payment-refunded.event'
import type { CardCreatedEvent } from '@api/domain/events/card-created.event'
import type { CardUpdatedEvent } from '@api/domain/events/card-updated.event'
import type { PropertyUnlockedEvent } from '@api/domain/events/property-unlocked.event'
import type { SubscriptionDeactivatedEvent } from '@api/domain/events/subscription-deactivated.event'
import type { SubscriptionPausedEvent } from '@api/domain/events/subscription-paused.event'
import type { SubscriptionCancelledEvent } from '@api/domain/events/subscription-cancelled.event'
import type { SubscriptionDowngradedEvent } from '@api/domain/events/subscription-downgraded.event'

import SubscriptionCreatedEmail from '@api/infrastructure/email/templates/subscription-created.email'
import TrialWelcomeEmail from '@api/infrastructure/email/templates/trial-welcome.email'
import SubscriptionRenewalEmail from '@api/infrastructure/email/templates/subscription-renewal.email'
import PaymentConfirmationEmail from '@api/infrastructure/email/templates/payment-confirmation.email'
import PaymentErrorEmail from '@api/infrastructure/email/templates/payment-error.email'
import RefundEmail from '@api/infrastructure/email/templates/refund.email'
import CardUpdatedEmail from '@api/infrastructure/email/templates/card-updated.email'
import SubscriptionSuspendedEmail from '@api/infrastructure/email/templates/subscription-suspended.email'
import SubscriptionPausedEmail from '@api/infrastructure/email/templates/subscription-paused.email'
import SubscriptionCancelledEmail from '@api/infrastructure/email/templates/subscription-cancelled.email'
import SubscriptionDowngradedEmail from '@api/infrastructure/email/templates/subscription-downgraded.email'

/**
 * Handles sending email notifications in response to domain events.
 * Email failures are logged but don't fail the event processing (non-critical).
 *
 * Each handler renders a typed React Email component to HTML and passes
 * the result to the email service. No more stringly-typed template names or fields.
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

  private formatSubject(subject: string, environment?: 'production' | 'sandbox'): string {
    return environment === 'sandbox' ? `[SANDBOX] ${subject}` : subject
  }

  /** Merge the resolved whitelabel name into branding props for templates */
  private toBrandingProps(whitelabelInfo: { name: string; branding: any }) {
    return { ...whitelabelInfo.branding, name: whitelabelInfo.name }
  }

  private formatCurrency(amountInCents: number): string {
    return `$${(amountInCents / 100).toFixed(2)}`
  }

  private formatDate(): string {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  private isSandbox(environment?: 'production' | 'sandbox'): boolean {
    return environment === 'sandbox'
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

  private async handleSubscriptionCreated(event: SubscriptionCreatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, userId, productName, amount, initialChargeAmount, environment, lineItems, externalTransactionId, nextRenewalDate, userWasCreated } = event.payload
        const chargedAmount = initialChargeAmount ?? amount

        // Don't send a welcome email if user provisioning failed — the use case
        // already sends a customer error email via sendCustomerPurchaseErrorEmail.
        if (userWasCreated === false) {
          this.logger.info('Skipping subscription created email — user provisioning failed', {
            email,
            subscriptionId: event.payload.subscriptionId,
          })
          return
        }

        this.logger.info('Sending subscription created email', {
          email,
          subscriptionId: event.payload.subscriptionId,
          environment,
        })

        // Fetch whitelabel for this user
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        // Check if this is a free trial (amount=0, product name contains "Trial")
        const isTrial = amount === 0 && (productName?.toLowerCase().includes('trial') || false)

        if (isTrial && nextRenewalDate) {
          const productData = event.metadata?.productData as any
          const trialDays = productData?.homeuptick?.free_trial?.duration_days ?? 90
          const expirationDate = new Date(nextRenewalDate).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })

          const html = await render(
            <TrialWelcomeEmail
              trialDays={trialDays}
              expirationDate={expirationDate}
              isSandbox={this.isSandbox(environment)}
              whitelabel={this.toBrandingProps(whitelabelInfo)}
            />
          )

          await this.emailService.sendEmail({
            to: email,
            subject: this.formatSubject('Welcome to Your Free Trial!', environment),
            html,
            templateName: 'trial-welcome',
          })
          return
        }

        const html = await render(
          <SubscriptionCreatedEmail
            subscription={productName}
            amount={this.formatCurrency(chargedAmount)}
            lineItems={(lineItems ?? []).map((item) => ({ description: item.description, amount: item.amount }))}
            date={this.formatDate()}
            transactionID={externalTransactionId}
            isSandbox={this.isSandbox(environment)}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject(`Welcome to ${whitelabelInfo.name}!`, environment),
          html,
          templateName: 'subscription-created',
        })
      },
      event,
      'Failed to send subscription created email'
    )
  }

  private async handleSubscriptionRenewed(event: SubscriptionRenewedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, userId, productName, amount, environment, lineItems, externalTransactionId } = event.payload

        this.logger.info('Sending subscription renewal email', {
          email,
          subscriptionId: event.payload.subscriptionId,
          environment,
        })

        // Fetch whitelabel for this user
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <SubscriptionRenewalEmail
            subscription={productName}
            amount={this.formatCurrency(amount)}
            lineItems={(lineItems ?? []).map((item) => ({ description: item.description, amount: item.amount }))}
            date={this.formatDate()}
            transactionID={externalTransactionId}
            isSandbox={this.isSandbox(environment)}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject(`Your ${whitelabelInfo.name} Subscription Has Been Renewed`, environment),
          html,
          templateName: 'subscription-renewal',
        })
      },
      event,
      'Failed to send subscription renewal email'
    )
  }

  private async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, userId, amount, externalTransactionId, paymentType, environment } = event.payload

        // Only send email for one-time payments (subscriptions are handled separately)
        if (paymentType !== 'one-time' && paymentType !== 'unlock') {
          return
        }

        this.logger.info('Sending payment confirmation email', {
          email,
          transactionId: event.payload.transactionId,
          paymentType,
          environment,
        })

        const whitelabelInfo = userId ? await whitelabelResolverService.resolveForUser(userId) : null

        const html = await render(
          <PaymentConfirmationEmail
            amount={this.formatCurrency(amount)}
            transactionID={externalTransactionId}
            date={new Date().toLocaleDateString()}
            isSandbox={this.isSandbox(environment)}
            whitelabel={whitelabelInfo ? this.toBrandingProps(whitelabelInfo) : undefined}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject('Payment Successful', environment),
          html,
          templateName: 'payment-confirmation',
        })
      },
      event,
      'Failed to send payment confirmation email'
    )
  }

  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount, errorMessage, errorCode, errorCategory, subscriptionId, cardLast4, environment, willRetry, nextRetryDate } = event.payload

        this.logger.info('Sending payment failed email', {
          email,
          subscriptionId,
          environment,
          willRetry,
        })

        // Determine urgency based on retry context
        let urgency: 'first' | 'second' | 'final' | undefined
        if (willRetry && nextRetryDate) {
          const daysUntilRetry = Math.round(
            (new Date(nextRetryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          if (daysUntilRetry <= 2) urgency = 'first'
          else if (daysUntilRetry <= 5) urgency = 'second'
          else urgency = 'final'
        } else if (!willRetry) {
          urgency = 'final'
        }

        const nextRetryDateStr = nextRetryDate
          ? new Date(nextRetryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : undefined

        const subject = !willRetry
          ? 'Subscription Suspended - Payment Failed'
          : urgency === 'final'
            ? 'Final Payment Attempt - Action Required'
            : 'Payment Failed - Action Required'

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)
        const brandingProps = this.toBrandingProps(whitelabelInfo)
        const billingUrl = brandingProps.billing_url ?? 'https://billing.cashoffers.com'

        const html = await render(
          <PaymentErrorEmail
            amount={this.formatCurrency(amount)}
            errorMessage={errorMessage}
            declineReason={errorCode ?? errorCategory}
            subscription={subscriptionId ? `Subscription #${subscriptionId}` : undefined}
            cardLast4={cardLast4}
            updatePaymentUrl={billingUrl}
            date={this.formatDate()}
            isSandbox={this.isSandbox(environment)}
            willRetry={willRetry}
            nextRetryDate={nextRetryDateStr}
            urgency={urgency}
            whitelabel={brandingProps}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject(subject, environment),
          html,
          templateName: 'payment-error',
        })
      },
      event,
      'Failed to send payment failed email'
    )
  }

  private async handlePaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount, environment, externalRefundId } = event.payload

        this.logger.info('Sending payment refunded email', {
          email,
          transactionId: event.payload.transactionId,
          environment,
        })

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <RefundEmail
            amount={this.formatCurrency(amount)}
            date={this.formatDate()}
            transactionId={externalRefundId}
            isSandbox={this.isSandbox(environment)}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject('Payment Refunded', environment),
          html,
          templateName: 'refund',
        })
      },
      event,
      'Failed to send payment refunded email'
    )
  }

  private async handleCardCreated(event: CardCreatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, cardLast4, environment, userId } = event.payload

        this.logger.info('Sending card created email', {
          email,
          cardId: event.payload.cardId,
          environment,
        })

        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <CardUpdatedEmail
            message={`A card ending in ${cardLast4} was added to your account`}
            card={`**** **** **** ${cardLast4}`}
            date={new Date().toLocaleDateString()}
            isSandbox={this.isSandbox(environment)}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject('A Card Was Added to Your Account', environment),
          html,
          templateName: 'card-updated',
        })
      },
      event,
      'Failed to send card created email'
    )
  }

  private async handleCardUpdated(event: CardUpdatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, cardLast4, environment, userId } = event.payload

        this.logger.info('Sending card updated email', {
          email,
          cardId: event.payload.cardId,
          environment,
        })

        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <CardUpdatedEmail
            message={`The card linked to your account was updated and now ends in ${cardLast4}`}
            card={`**** **** **** ${cardLast4}`}
            date={new Date().toLocaleDateString()}
            isSandbox={this.isSandbox(environment)}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: this.formatSubject('The Card on Your Account Was Updated', environment),
          html,
          templateName: 'card-updated',
        })
      },
      event,
      'Failed to send card updated email'
    )
  }

  private async handlePropertyUnlocked(event: PropertyUnlockedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, amount, externalTransactionId, propertyAddress, userId } = event.payload

        this.logger.info('Sending property unlocked email', {
          email,
          propertyId: event.payload.propertyId,
        })

        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <PaymentConfirmationEmail
            amount={this.formatCurrency(amount)}
            transactionID={externalTransactionId}
            date={this.formatDate()}
            description={propertyAddress ? `Property Unlock — ${propertyAddress}` : 'Property Unlock'}
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: 'Property Unlocked',
          html,
          templateName: 'payment-confirmation',
        })
      },
      event,
      'Failed to send property unlocked email'
    )
  }

  private async handleSubscriptionDeactivated(event: SubscriptionDeactivatedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName } = event.payload

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

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)
        const brandingProps = this.toBrandingProps(whitelabelInfo)
        const billingUrl = brandingProps.billing_url ?? 'https://billing.cashoffers.com'

        const html = await render(
          <SubscriptionSuspendedEmail
            subscription={subscriptionName ?? 'your subscription'}
            link={billingUrl}
            date={this.formatDate()}
            whitelabel={brandingProps}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Has Been Deactivated',
          html,
          templateName: 'subscription-suspended',
        })
      },
      event,
      'Failed to send subscription deactivated email'
    )
  }

  private async handleSubscriptionPaused(event: SubscriptionPausedEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName } = event.payload

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

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)
        const brandingProps = this.toBrandingProps(whitelabelInfo)

        const html = await render(
          <SubscriptionPausedEmail
            subscription={subscriptionName ?? 'your subscription'}
            date={this.formatDate()}
            whitelabel={brandingProps}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Has Been Paused',
          html,
          templateName: 'subscription-paused',
        })
      },
      event,
      'Failed to send subscription paused email'
    )
  }

  private async handleSubscriptionCancelled(event: SubscriptionCancelledEvent): Promise<void> {
    await this.safeExecute(
      async () => {
        const { email, subscriptionName, effectiveDate } = event.payload

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

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <SubscriptionCancelledEmail
            subscription={subscriptionName ?? 'your subscription'}
            effectiveDate={
              effectiveDate
                ? effectiveDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : undefined
            }
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Will Be Cancelled',
          html,
          templateName: 'subscription-cancelled',
        })
      },
      event,
      'Failed to send subscription cancelled email'
    )
  }

  private async handleSubscriptionDowngraded(event: SubscriptionDowngradedEvent): Promise<void> {
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

        const { userId } = event.payload
        const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

        const html = await render(
          <SubscriptionDowngradedEmail
            subscription={currentSubscriptionName ?? 'your subscription'}
            targetPlan={targetProductName}
            effectiveDate={
              effectiveDate
                ? effectiveDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : undefined
            }
            whitelabel={this.toBrandingProps(whitelabelInfo)}
          />
        )

        await this.emailService.sendEmail({
          to: email,
          subject: 'Your Subscription Will Be Downgraded',
          html,
          templateName: 'subscription-downgraded',
        })
      },
      event,
      'Failed to send subscription downgraded email'
    )
  }
}
