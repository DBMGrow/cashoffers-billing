import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { RefundPaymentInput, RefundPaymentOutput } from "../types/payment.types"

/**
 * Use case interface for refunding a payment
 */
export interface IRefundPaymentUseCase
  extends IUseCase<RefundPaymentInput, UseCaseResult<RefundPaymentOutput>> {}
