import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CreateSubscriptionInput, CreateSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for creating a new subscription
 */
export interface ICreateSubscriptionUseCase
  extends IUseCase<CreateSubscriptionInput, UseCaseResult<CreateSubscriptionOutput>> {}
