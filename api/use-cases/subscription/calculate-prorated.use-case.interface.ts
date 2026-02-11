import { UseCaseResult } from '../base/use-case.interface'

export interface CalculateProratedInput {
  productId: number
  userId: number
}

export interface CalculateProratedOutput {
  proratedAmount: number
  startDate: Date
  renewalDate: Date
  duration: string
  currentPlanCost: number
  newPlanCost: number
  totalDuration: number
  timeRemaining: number
  percentOfTimeRemaining: number
  totalSubscriptionCostDifference: number
}

export interface ICalculateProratedUseCase {
  execute(input: CalculateProratedInput): Promise<UseCaseResult<CalculateProratedOutput>>
}
