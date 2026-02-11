import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { MarkForDowngradeInput, MarkForDowngradeOutput } from "../types/subscription.types"

/**
 * Use case interface for marking/unmarking subscription for downgrade on renewal
 */
export interface IMarkForDowngradeUseCase
  extends IUseCase<MarkForDowngradeInput, UseCaseResult<MarkForDowngradeOutput>> {}
