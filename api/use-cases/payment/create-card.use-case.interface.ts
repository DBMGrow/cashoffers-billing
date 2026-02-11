import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CreateCardInput, CreateCardOutput } from "../types/payment.types"

/**
 * Use case interface for creating a card
 */
export interface ICreateCardUseCase extends IUseCase<CreateCardInput, UseCaseResult<CreateCardOutput>> {}
