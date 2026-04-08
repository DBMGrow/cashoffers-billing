import { v4 as uuid } from "uuid"
import type { MiddlewareHandler } from "hono"

/**
 * Digest middleware
 * Adds a unique request ID to each request for logging/tracking
 */
export const digestMiddleware: MiddlewareHandler = async (c, next) => {
  // Add unique ID to request context
  c.set("requestId", uuid())

  await next()
}
