import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CheckUserCardInfoInput, CheckUserCardInfoOutput } from "../types/card.types"

/**
 * Use case interface for checking if user has a card
 */
export interface ICheckUserCardInfoUseCase extends IUseCase<CheckUserCardInfoInput, UseCaseResult<CheckUserCardInfoOutput>> {}
