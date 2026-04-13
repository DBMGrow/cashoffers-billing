import { createElement } from "react"
import { render } from "@react-email/render"
import { config } from "@api/config/config.service"
import { logger, emailService, eventBus } from "@api/lib/services"
import { db } from "@api/lib/database"
import { subscriptionRepository, transactionRepository } from "@api/lib/repositories"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"
import { SubscriptionCancelledEvent } from "@api/domain/events/subscription-cancelled.event"
import TrialExpiringEmail from "@api/infrastructure/email/templates/trial-expiring.email"
import TrialExpiredEmail from "@api/infrastructure/email/templates/trial-expired.email"

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

      if (subscriptionData.cancel_on_renewal) {
        // Cancel subscription logic is handled during renewal
        // The subscription should be deactivated, not renewed
        cronLogger.info('Subscription marked for cancellation, skipping renewal', {
          subscriptionId: subscriptionData.subscription_id,
        })
        continue
      } else if (subscriptionData.downgrade_on_renewal) {
        // Downgrade subscription logic is handled during renewal
        // The subscription should be downgraded to a lower tier
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
          cronLogger.error('Failed to renew subscription', undefined, {
            subscriptionId: subscriptionData.subscription_id,
            error: result.error,
          })
        }
      } catch (error: any) {
        cronLogger.error('Error renewing subscription', error, {
          subscriptionId: subscriptionData.subscription_id,
        })
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
