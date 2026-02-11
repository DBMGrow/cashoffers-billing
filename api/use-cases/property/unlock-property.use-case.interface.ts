import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { UnlockPropertyInput, UnlockPropertyOutput } from "../types/property.types"

/**
 * Use case interface for unlocking a property
 */
export interface IUnlockPropertyUseCase
  extends IUseCase<UnlockPropertyInput, UseCaseResult<UnlockPropertyOutput>> {}
