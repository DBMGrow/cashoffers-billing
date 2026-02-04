import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { UpdateSubscriptionFieldsInput, UpdateSubscriptionFieldsOutput } from "../types/subscription.types"

/**
 * Use case interface for updating subscription fields
 */
export interface IUpdateSubscriptionFieldsUseCase
  extends IUseCase<UpdateSubscriptionFieldsInput, UseCaseResult<UpdateSubscriptionFieldsOutput>> {}
