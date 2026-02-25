import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { NewUserPurchaseInput, PurchaseSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for purchasing a subscription as a new user.
 * Handles user creation, card creation, and the full purchase flow.
 */
export interface IPurchaseNewUserUseCase
  extends IUseCase<NewUserPurchaseInput, UseCaseResult<PurchaseSubscriptionOutput>> {}
