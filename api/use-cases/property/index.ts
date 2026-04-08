import { logger, paymentProvider, eventBus, configService, criticalAlertService } from '@api/lib/services'
import { transactionRepository, productRepository } from '@api/lib/repositories'
import { UnlockPropertyUseCase } from './unlock-property.use-case'

export const unlockPropertyUseCase = new UnlockPropertyUseCase({
  logger,
  paymentProvider,
  transactionRepository,
  productRepository,
  config: configService,
  eventBus,
  criticalAlertService,
})
