import fetch from "node-fetch"
import { getContainer } from "@api/container"

export default async function subscriptionsCron() {
  // Get container and dependencies
  const container = getContainer()
  const subscriptionRepository = container.repositories.subscription
  const transactionRepository = container.repositories.transaction
  const emailService = container.services.email

  // Create child logger with cron context
  const cronLogger = container.logger.child({
    component: 'subscriptionsCron',
    contextType: 'cron_job',
  })

  cronLogger.info('Running subscriptions cron')

  try {
    const subscriptions = await subscriptionRepository.findSubscriptionsForCronProcessing(new Date())

    cronLogger.info('Subscriptions to process', {
      count: subscriptions.length,
      subscriptionIds: subscriptions.map((sub) => sub.subscription_id),
    })

    const usersResponse = await fetch(process.env.API_URL + "/users/mini?page=1&limit=50000", {
      headers: {
        "x-api-token": process.env.API_MASTER_TOKEN!,
      },
    })
    const users: any = await usersResponse.json()

    if (users?.success !== "success") throw new Error("Error fetching users")

    // Get use case from container
    const renewSubscriptionUseCase = container.useCases.renewSubscription

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

      const user = users?.data?.find((u: any) => u.user_id === subscriptionData.user_id)
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
  } catch (error: any) {
    cronLogger.error('Fatal error in subscriptions cron', error)

    // Send error notification using new email service
    await emailService.sendPlainEmail({
      to: process.env.ADMIN_EMAIL!,
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
