import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { GetUserCardInput, GetUserCardOutput } from "../types/card.types"

/**
 * Use case interface for getting a user's card
 */
export interface IGetUserCardUseCase extends IUseCase<GetUserCardInput, UseCaseResult<GetUserCardOutput>> {}
