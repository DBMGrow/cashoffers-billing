import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { PurchaseSubscriptionInput, PurchaseSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for purchasing a subscription
 * Handles the complete purchase flow including user/card creation
 */
export interface IPurchaseSubscriptionUseCase
  extends IUseCase<PurchaseSubscriptionInput, UseCaseResult<PurchaseSubscriptionOutput>> {}
