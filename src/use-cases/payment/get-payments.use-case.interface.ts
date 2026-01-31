import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { GetPaymentsInput, GetPaymentsOutput } from "../types/payment.types"

/**
 * Use case interface for getting payments
 */
export interface IGetPaymentsUseCase
  extends IUseCase<GetPaymentsInput, UseCaseResult<GetPaymentsOutput>> {}
