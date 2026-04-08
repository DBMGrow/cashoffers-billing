import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { ExistingUserPurchaseInput, PurchaseSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for purchasing a subscription as an existing authenticated user.
 * User identity is resolved from the session token before this use case is called.
 */
export interface IPurchaseExistingUserUseCase
  extends IUseCase<ExistingUserPurchaseInput, UseCaseResult<PurchaseSubscriptionOutput>> {}
