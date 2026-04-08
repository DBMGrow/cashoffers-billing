import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CancelOnRenewalInput, CancelOnRenewalOutput } from "../types/subscription.types"

/**
 * Use case interface for marking/unmarking subscription for cancellation on renewal
 */
export interface ICancelOnRenewalUseCase
  extends IUseCase<CancelOnRenewalInput, UseCaseResult<CancelOnRenewalOutput>> {}
