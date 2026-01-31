import { Context } from "hono"
import { UseCaseResult } from "@/use-cases/base/use-case.interface"

/**
 * Execute a use case and handle the response consistently
 * Eliminates need for try-catch blocks in route handlers
 */
export async function executeUseCase<T>(
  c: Context,
  useCaseExecutor: () => Promise<UseCaseResult<T>>,
  options?: {
    successStatus?: number
  }
) {
  try {
    const result = await useCaseExecutor()

    if (!result.success) {
      return c.json(
        {
          success: "error",
          error: result.error,
          code: result.code,
        },
        400
      )
    }

    return c.json(
      {
        success: "success",
        data: result.data,
      },
      (options?.successStatus || 200) as any
    )
  } catch (error) {
    // Catch any unexpected errors that escaped the use case
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return c.json(
      {
        success: "error",
        error: errorMessage,
      },
      500
    )
  }
}

/**
 * Simpler wrapper for use cases that just need data extraction
 */
export function handleUseCaseResult<T>(result: UseCaseResult<T>) {
  if (!result.success) {
    return {
      success: "error" as const,
      error: result.error,
      code: result.code,
    }
  }

  return {
    success: "success" as const,
    data: result.data,
  }
}
