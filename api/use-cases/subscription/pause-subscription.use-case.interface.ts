import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { PauseSubscriptionInput, PauseSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for pausing a subscription
 */
export interface IPauseSubscriptionUseCase
  extends IUseCase<PauseSubscriptionInput, UseCaseResult<PauseSubscriptionOutput>> {}
