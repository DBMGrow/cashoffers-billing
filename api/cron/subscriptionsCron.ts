import { createElement } from "react"
import { render } from "@react-email/render"
import { config } from "@api/config/config.service"
import { logger, emailService, eventBus, whitelabelResolverService } from "@api/lib/services"
import { db } from "@api/lib/database"
import { subscriptionRepository, transactionRepository, userCardRepository } from "@api/lib/repositories"
import { readSubscriptionTrial } from "@api/domain/services/subscription-trial"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"
import { SubscriptionCancelledEvent } from "@api/domain/events/subscription-cancelled.event"
import TrialExpiringEmail from "@api/infrastructure/email/templates/trial-expiring.email"
import TrialExpiredEmail from "@api/infrastructure/email/templates/trial-expired.email"
import TrialEndingEmail from "@api/infrastructure/email/templates/trial-ending.email"

/** Days before a card-on-file trial's first charge that the trial-ending reminder goes out. */
const TRIAL_REMINDER_DAYS = 7

export default async function subscriptionsCron() {
  // Create child logger with cron context
  const cronLogger = logger.child({
    component: 'subscriptionsCron',
    contextType: 'cron_job',
  })

  cronLogger.info('Running subscriptions cron')

  try {
    const subscriptions = await subscriptionRepository.findSubscriptionsForCronProcessing(new Date())

    cronLogger.info('Subscriptions to process', {
      count: subscriptions.length,
      subscriptionIds: subscriptions.map((sub: any) => sub.subscription_id),
    })

    // Fetch users directly from DB instead of bulk-loading all via API (which can 504)
    const userCache = new Map<number, any>()

    async function getUser(userId: number) {
      if (userCache.has(userId)) return userCache.get(userId)
      const user = await db.selectFrom("Users").selectAll().where("user_id", "=", userId).executeTakeFirst()
      userCache.set(userId, user)
      return user
    }

    for (const subscription of subscriptions) {
      const subscriptionData = subscription
      cronLogger.info('Processing subscription', {
        subscriptionId: subscriptionData.subscription_id,
      })

      // NOTE: cancel_on_renewal is intentionally NOT short-circuited here.
      // RenewSubscriptionUseCase handles it: it cancels the subscription (no
      // charge) and emits SubscriptionCancelledEvent, which drives the
      // whitelabel suspension strategy (DEACTIVATE_USER → SHELL role,
      // DOWNGRADE_TO_FREE → is_premium 0, role preserved). Skipping it here
      // left cancelled subscriptions stuck "active" with a past renewal date,
      // re-surfacing every cron tick and never downgrading the user.
      if (subscriptionData.downgrade_on_renewal) {
        // downgrade_on_renewal is currently unused (nothing sets a downgrade
        // target product). Skip defensively so an unhandled flag can never
        // trigger a full-price charge if it were ever set.
        cronLogger.info('Subscription marked for downgrade, skipping renewal', {
          subscriptionId: subscriptionData.subscription_id,
        })
        continue
      }

      if (subscriptionData.user_id == null) {
        cronLogger.warn('Subscription has no user_id, skipping', {
          subscriptionId: subscriptionData.subscription_id,
        })
        continue
      }

      const user = await getUser(subscriptionData.user_id)
      const email = user?.email || ""

      if (!email) {
        cronLogger.warn('No email found for user', {
          userId: subscriptionData.user_id,
          subscriptionId: subscriptionData.subscription_id,
        })
        continue
      }

      // if user active = 0, skip subscription renewal attempt
      if (user?.active === 0) {
        cronLogger.info('User is inactive, skipping subscription renewal attempt', {
          userId: subscriptionData.user_id,
          subscriptionId: subscriptionData.subscription_id,
        })
        continue
      }

      // Use the RenewSubscriptionUseCase
      try {
        const result = await renewSubscriptionUseCase.execute({
          subscriptionId: subscriptionData.subscription_id,
          email,
        })

        if (result.success) {
          cronLogger.info('Successfully renewed subscription', {
            subscriptionId: subscriptionData.subscription_id,
          })
        } else {
          cronLogger.error(
            `Failed to renew subscription ${subscriptionData.subscription_id}: ${result.error || 'no error reason returned'}`,
            undefined,
            {
              subscriptionId: subscriptionData.subscription_id,
              error: result.error,
            }
          )
        }
      } catch (error: any) {
        const reason = error instanceof Error ? error.message : String(error)
        cronLogger.error(
          `Error renewing subscription ${subscriptionData.subscription_id}: ${reason}`,
          error,
          {
            subscriptionId: subscriptionData.subscription_id,
          }
        )
      }
    }
    // Expire trials whose renewal_date has passed
    try {
      const expiredTrials = await subscriptionRepository.findExpiredTrials(new Date())
      cronLogger.info('Expired trials to process', { count: expiredTrials.length })

      for (const trial of expiredTrials) {
        try {
          const now = new Date()
          await subscriptionRepository.update(trial.subscription_id, {
            status: 'cancelled',
            updatedAt: now,
          } as any)

          await eventBus.publish(
            SubscriptionCancelledEvent.create({
              subscriptionId: trial.subscription_id,
              userId: trial.user_id!,
              subscriptionName: trial.subscription_name ?? undefined,
              reason: 'trial_expired',
              cancelOnRenewal: false,
            })
          )

          // Send trial-expired email
          const trialUser = trial.user_id ? await getUser(trial.user_id) : null
          if (trialUser?.email) {
            try {
              const html = await render(createElement(TrialExpiredEmail, {}))
              await emailService.sendEmail({
                to: trialUser.email,
                subject: 'Your Free Trial Has Expired',
                html,
                templateName: 'trial-expired',
              })
            } catch (emailErr: any) {
              cronLogger.warn('Failed to send trial expired email', { userId: trial.user_id, error: emailErr.message })
            }
          }

          cronLogger.info('Expired trial cancelled', { subscriptionId: trial.subscription_id })
        } catch (err: any) {
          cronLogger.error('Failed to expire trial', err, { subscriptionId: trial.subscription_id })
        }
      }
    } catch (err: any) {
      cronLogger.error('Error processing expired trials', err)
    }

    // Send trial warning emails (10 days before expiry)
    try {
      const expiringTrials = await subscriptionRepository.findTrialsExpiringSoon(10)
      cronLogger.info('Trials expiring soon', { count: expiringTrials.length })

      for (const trial of expiringTrials) {
        try {
          const trialUser = trial.user_id ? await getUser(trial.user_id) : null
          if (!trialUser?.email) continue

          const renewalDate = new Date(trial.renewal_date!)
          const daysRemaining = Math.max(1, Math.ceil(
            (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ))
          const expirationDate = renewalDate.toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })

          const html = await render(
            createElement(TrialExpiringEmail, { daysRemaining, expirationDate })
          )
          await emailService.sendEmail({
            to: trialUser.email,
            subject: `Your Free Trial Expires in ${daysRemaining} Days`,
            html,
            templateName: 'trial-expiring',
          })

          cronLogger.info('Sent trial warning email', { userId: trial.user_id, daysRemaining })
        } catch (err: any) {
          cronLogger.warn('Failed to send trial warning email', { userId: trial.user_id, error: err.message })
        }
      }
    } catch (err: any) {
      cronLogger.error('Error processing trial warnings', err)
    }

    // Card-on-file free trials (Desk #1350): one "your card will be charged" reminder 7 days
    // before the first charge. `data.trial.reminder_sent_at` is the idempotency key, stamped only
    // after the send succeeds, so a failed send is retried on the next run and a sent one never is.
    try {
      const endingTrials = await subscriptionRepository.findTrialsEndingWithin(TRIAL_REMINDER_DAYS)
      cronLogger.info('Card trials ending soon', { count: endingTrials.length })

      for (const subscription of endingTrials) {
        const subscriptionId = subscription.subscription_id
        try {
          const trial = readSubscriptionTrial(subscription.data)
          const trialUser = subscription.user_id ? await getUser(subscription.user_id) : null
          if (!trial || !trialUser?.email) {
            cronLogger.warn('Trial-ending reminder skipped: no trial marker or no email', { subscriptionId })
            continue
          }

          const [card] = await userCardRepository.findByUserId(subscription.user_id!)
          const whitelabelInfo = await whitelabelResolverService.resolveForUser(subscription.user_id!)
          const billingBase = (whitelabelInfo.branding?.billing_url ?? 'https://account.cashoffers.pro').replace(/\/$/, '')
          const isSandbox = subscription.square_environment === 'sandbox'
          const chargeDate = new Date(trial.ends_at).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })

          const html = await render(
            createElement(TrialEndingEmail, {
              subscription: subscription.subscription_name,
              amount: `$${(subscription.amount / 100).toFixed(2)}`,
              chargeDate,
              cardLast4: card?.last_4 || undefined,
              manageUrl: `${billingBase}/manage`,
              isSandbox,
              whitelabel: { ...whitelabelInfo.branding, name: whitelabelInfo.name },
            })
          )
          await emailService.sendEmail({
            to: trialUser.email,
            subject: `${isSandbox ? '[SANDBOX] ' : ''}Your free trial ends on ${chargeDate}`,
            html,
            templateName: 'trial-ending',
            fromName: whitelabelInfo.name,
          })

          await subscriptionRepository.stampTrialReminderSent(subscriptionId, new Date())
          cronLogger.info('Sent trial-ending reminder', { subscriptionId, userId: subscription.user_id, endsAt: trial.ends_at })
        } catch (err: any) {
          cronLogger.warn('Trial-ending reminder failed and was not stamped, will retry next run', {
            subscriptionId,
            error: err?.message,
          })
        }
      }
    } catch (err: any) {
      cronLogger.error('Error processing trial-ending reminders', err)
    }

    // Card-on-file trial invariants (Desk #1350), read-only: each anomaly becomes an `error` row in
    // BillingLogs naming the subscription, so it reaches the daily health report's error list. The
    // report counts the same two queries in its Free Trials section.
    try {
      const now = new Date()
      const [withoutCard, unreconciled] = await Promise.all([
        subscriptionRepository.findTrialsWithoutCard(now),
        subscriptionRepository.findEndedTrialsUnreconciled(now),
      ])

      for (const subscription of withoutCard) {
        cronLogger.error(`Trial has no card on file: subscription ${subscription.subscription_id}`, undefined, {
          subscription_id: subscription.subscription_id,
          user_id: subscription.user_id,
          product_id: subscription.product_id,
          subjectUserId: subscription.user_id,
        })
      }
      for (const subscription of unreconciled) {
        cronLogger.error(`Ended trial not reconciled: subscription ${subscription.subscription_id}`, undefined, {
          subscription_id: subscription.subscription_id,
          user_id: subscription.user_id,
          product_id: subscription.product_id,
          subjectUserId: subscription.user_id,
        })
      }
    } catch (err: any) {
      cronLogger.error('Error checking card-on-file trial invariants', err)
    }
  } catch (error: any) {
    cronLogger.error('Fatal error in subscriptions cron', error)

    // Send error notification using new email service
    await emailService.sendPlainEmail({
      to: config.adminEmail,
      subject: "Subscription Cron Error",
      text: `There was an error processing subscriptions: ${error.message}`,
      html: `<p>There was an error processing subscriptions: ${error.message}</p>`,
    })
    await transactionRepository.create({
      user_id: 0,
      amount: 0,
      type: "cron",
      memo: "Subscriptions failed",
      status: "failed",
      data: JSON.stringify(error),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}
