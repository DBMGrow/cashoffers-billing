import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { UpdateSubscriptionUseCase as UpdateSubType, UpdateSubscriptionOutput } from "../types/subscription.types"

/**
 * Use case interface for updating an existing subscription with basic fields
 */
export interface IUpdateSubscriptionUseCase extends IUseCase<UpdateSubType, UseCaseResult<UpdateSubscriptionOutput>> {}
