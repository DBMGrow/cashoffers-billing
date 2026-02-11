import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CreatePaymentInput, CreatePaymentOutput } from "../types/payment.types"

/**
 * Use case interface for creating a payment
 */
export interface ICreatePaymentUseCase
  extends IUseCase<CreatePaymentInput, UseCaseResult<CreatePaymentOutput>> {}
