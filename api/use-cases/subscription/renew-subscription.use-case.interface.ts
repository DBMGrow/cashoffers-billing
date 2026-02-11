import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { RenewSubscriptionInput, RenewSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for renewing a subscription
 */
export interface IRenewSubscriptionUseCase
  extends IUseCase<RenewSubscriptionInput, UseCaseResult<RenewSubscriptionOutput>> {}
