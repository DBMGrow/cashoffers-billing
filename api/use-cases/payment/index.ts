import { logger, paymentProvider, emailService, eventBus, configService, userApiClient } from '@api/lib/services'
import { userCardRepository, transactionRepository, subscriptionRepository } from '@api/lib/repositories'
import { CreatePaymentUseCase } from './create-payment.use-case'
import { RefundPaymentUseCase } from './refund-payment.use-case'
import { CreateCardUseCase } from './create-card.use-case'
import { GetPaymentsUseCase } from './get-payments.use-case'

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

export const createCardUseCase = new CreateCardUseCase({
  logger,
  paymentProvider,
  userCardRepository,
  transactionRepository,
  subscriptionRepository,
  emailService,
  eventBus,
})

export const getPaymentsUseCase = new GetPaymentsUseCase({
  logger,
  transactionRepository,
})
