import { logger, paymentProvider, emailService, eventBus, configService, userApiClient, transactionManager, homeUptickApiClient } from '@api/lib/services'
import { userCardRepository, transactionRepository, subscriptionRepository, purchaseRequestRepository, whitelabelRepository } from '@api/lib/repositories'
import { config } from '@api/config/config.service'
import { CreatePaymentUseCase } from './create-payment.use-case'
import { RefundPaymentUseCase } from './refund-payment.use-case'
import { CreateCardUseCase } from './create-card.use-case'
import { GetPaymentsUseCase } from './get-payments.use-case'
import { RenewSubscriptionUseCase } from '../subscription/renew-subscription.use-case'

export const createPaymentUseCase = new CreatePaymentUseCase({
  logger,
  paymentProvider,
  emailService,
  userCardRepository,
  transactionRepository,
  config: configService,
  eventBus,
})

export const refundPaymentUseCase = new RefundPaymentUseCase({
  logger,
  paymentProvider,
  emailService,
  transactionRepository,
  userApiClient,
  config: configService,
  eventBus,
})

const renewSubscriptionUseCaseForCard = new RenewSubscriptionUseCase({
  logger,
  paymentProvider,
  emailService,
  subscriptionRepository,
  transactionRepository,
  userCardRepository,
  purchaseRequestRepository,
  config: configService,
  transactionManager,
  eventBus,
  homeUptickApiClient,
  whitelabelRepository,
  adminAlertEmail: config.adminEmail,
})

export const createCardUseCase = new CreateCardUseCase({
  logger,
  paymentProvider,
  userCardRepository,
  transactionRepository,
  subscriptionRepository,
  emailService,
  eventBus,
  renewSubscriptionUseCase: renewSubscriptionUseCaseForCard,
})

export const getPaymentsUseCase = new GetPaymentsUseCase({
  logger,
  transactionRepository,
})
