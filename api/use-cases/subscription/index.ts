import { logger, paymentProvider, emailService, eventBus, configService, transactionManager, userApiClient, homeUptickApiClient, criticalAlertService } from '@api/lib/services'
import { config } from '@api/config/config.service'
import { subscriptionRepository, transactionRepository, userCardRepository, productRepository, purchaseRequestRepository, whitelabelRepository, homeUptickSubscriptionRepository } from '@api/lib/repositories'
import { CreateSubscriptionUseCase } from './create-subscription.use-case'
import { RenewSubscriptionUseCase } from './renew-subscription.use-case'
import { PauseSubscriptionUseCase } from './pause-subscription.use-case'
import { ResumeSubscriptionUseCase } from './resume-subscription.use-case'
import { CancelOnRenewalUseCase } from './cancel-on-renewal.use-case'
import { MarkForDowngradeUseCase } from './mark-for-downgrade.use-case'
import { UpdateSubscriptionFieldsUseCase } from './update-subscription-fields.use-case'
import { GetSubscriptionsUseCase } from './get-subscriptions.use-case'
import { PurchaseNewUserUseCase } from './purchase-new-user.use-case'
import { PurchaseExistingUserUseCase } from './purchase-existing-user.use-case'
import { DeactivateSubscriptionUseCase } from './deactivate-subscription.use-case'
import { CalculateProratedUseCase } from './calculate-prorated.use-case'

export const createSubscriptionUseCase = new CreateSubscriptionUseCase({
  logger,
  paymentProvider,
  emailService,
  userApiClient,
  subscriptionRepository,
  productRepository,
  transactionRepository,
  userCardRepository,
  eventBus,
})

export const renewSubscriptionUseCase = new RenewSubscriptionUseCase({
  logger,
  paymentProvider,
  emailService,
  subscriptionRepository,
  transactionRepository,
  userCardRepository,
  purchaseRequestRepository,
  productRepository,
  config: configService,
  transactionManager,
  eventBus,
  homeUptickApiClient,
  homeUptickSubscriptionRepository,
  whitelabelRepository,
  criticalAlertService,
  adminAlertEmail: config.adminEmail,
})

export const pauseSubscriptionUseCase = new PauseSubscriptionUseCase({
  logger,
  subscriptionRepository,
  transactionRepository,
  emailService,
  userApiClient,
  eventBus,
  productRepository,
  whitelabelRepository,
})

export const resumeSubscriptionUseCase = new ResumeSubscriptionUseCase({
  logger,
  subscriptionRepository,
  transactionRepository,
  eventBus,
})

export const cancelOnRenewalUseCase = new CancelOnRenewalUseCase({
  logger,
  subscriptionRepository,
  emailService,
  userApiClient,
  eventBus,
  productRepository,
  whitelabelRepository,
})

export const markForDowngradeUseCase = new MarkForDowngradeUseCase({
  logger,
  subscriptionRepository,
  emailService,
  userApiClient,
  eventBus,
})

export const updateSubscriptionFieldsUseCase = new UpdateSubscriptionFieldsUseCase({
  logger,
  subscriptionRepository,
  transactionRepository,
})

export const getSubscriptionsUseCase = new GetSubscriptionsUseCase({
  logger,
  subscriptionRepository,
})

export const purchaseNewUserUseCase = new PurchaseNewUserUseCase({
  logger,
  paymentProvider,
  emailService,
  userApiClient,
  productRepository,
  subscriptionRepository,
  userCardRepository,
  transactionRepository,
  purchaseRequestRepository,
  homeUptickSubscriptionRepository,
  eventBus,
  adminAlertEmail: config.adminEmail,
})

export const purchaseExistingUserUseCase = new PurchaseExistingUserUseCase({
  logger,
  paymentProvider,
  emailService,
  productRepository,
  subscriptionRepository,
  userCardRepository,
  transactionRepository,
  purchaseRequestRepository,
  homeUptickSubscriptionRepository,
  eventBus,
  adminAlertEmail: config.adminEmail,
})

export const deactivateSubscriptionUseCase = new DeactivateSubscriptionUseCase({
  logger,
  subscriptionRepository,
  userApiClient,
  eventBus,
  productRepository,
  whitelabelRepository,
})

export const calculateProratedUseCase = new CalculateProratedUseCase({
  logger,
  productRepository,
  subscriptionRepository,
})
