/**
 * Base interface for all use cases
 * Use cases encapsulate business logic and orchestrate between repositories and services
 */
export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>
}

/**
 * Standard result type for use case operations
 * Provides consistent success/error handling across all use cases
 */
export type UseCaseResult<TData = unknown> =
  | {
      success: true
      data: TData
    }
  | {
      success: false
      error: string
      code?: string
    }

/**
 * Helper to create success results
 */
export function success<TData>(data: TData): UseCaseResult<TData> {
  return { success: true, data }
}

/**
 * Helper to create error results
 */
export function failure(error: string, code?: string): UseCaseResult<never> {
  return { success: false, error, code }
}
