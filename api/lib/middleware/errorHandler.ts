import type { ErrorHandler } from "hono"

/**
 * Hono error handler
 * Catches all errors and returns a consistent JSON response
 */
export const errorHandler: ErrorHandler = (err, c) => {
  console.error("Error:", err.stack || err.message)

  // Determine status code (default to 500)
  const status = ("status" in err && typeof err.status === "number" ? err.status : 500) as any

  // Return error response
  return c.json(
    {
      success: "error",
      status: "error",
      error: err.message || "Internal server error",
    },
    status
  )
}
