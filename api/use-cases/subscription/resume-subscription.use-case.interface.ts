import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { ResumeSubscriptionInput, ResumeSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for resuming a subscription
 */
export interface IResumeSubscriptionUseCase
  extends IUseCase<ResumeSubscriptionInput, UseCaseResult<ResumeSubscriptionOutput>> {}
