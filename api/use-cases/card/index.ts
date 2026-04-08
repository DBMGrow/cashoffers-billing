import { logger } from '@api/lib/services'
import { userCardRepository } from '@api/lib/repositories'
import { GetUserCardUseCase } from './get-user-card.use-case'
import { CheckUserCardInfoUseCase } from './check-user-card-info.use-case'

export const getUserCardUseCase = new GetUserCardUseCase({
  logger,
  userCardRepository,
})

export const checkUserCardInfoUseCase = new CheckUserCardInfoUseCase({
  logger,
  userCardRepository,
})
