import { logger, paymentProvider, emailService, eventBus, configService } from '@api/lib/services'
import { transactionRepository, productRepository } from '@api/lib/repositories'
import { UnlockPropertyUseCase } from './unlock-property.use-case'

export const unlockPropertyUseCase = new UnlockPropertyUseCase({
  logger,
  paymentProvider,
  emailService,
  transactionRepository,
  productRepository,
  config: configService,
  eventBus,
})
