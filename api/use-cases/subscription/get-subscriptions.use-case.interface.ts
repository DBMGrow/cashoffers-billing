import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { GetSubscriptionsInput, GetSubscriptionsOutput } from "../types/subscription.types"

/**
 * Use case interface for getting subscriptions
 */
export interface IGetSubscriptionsUseCase
  extends IUseCase<GetSubscriptionsInput, UseCaseResult<GetSubscriptionsOutput>> {}
