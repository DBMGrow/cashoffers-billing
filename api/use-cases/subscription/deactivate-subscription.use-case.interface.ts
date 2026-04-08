import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { DeactivateSubscriptionInput, DeactivateSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for deactivating a subscription
 */
export interface IDeactivateSubscriptionUseCase extends IUseCase<DeactivateSubscriptionInput, UseCaseResult<DeactivateSubscriptionOutput>> {}
