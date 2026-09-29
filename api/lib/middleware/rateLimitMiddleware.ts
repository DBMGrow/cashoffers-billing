import type { MiddlewareHandler } from "hono"

/**
 * Best-effort, in-memory, fixed-window rate limit keyed by client IP.
 *
 * Used on public endpoints a script could hammer to enumerate values (promo codes). Each server
 * instance keeps its own counters, so on a multi-instance or serverless deploy the effective limit
 * is `limit` per instance: it slows guessing, it does not stop a distributed attacker. A shared
 * store (Redis) is the upgrade if that ever matters.
 */
export function rateLimitMiddleware(options: {
  limit: number
  windowMs: number
  keyPrefix: string
}): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>()

  return async (c, next) => {
    const now = Date.now()
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    const ip = forwarded || c.req.header("x-real-ip") || "unknown"
    const key = `${options.keyPrefix}:${ip}`

    // Drop expired windows now and then so the map cannot grow without bound.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }

    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs })
    } else {
      entry.count += 1
      if (entry.count > options.limit) {
        c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)))
        return c.json(
          { success: "error" as const, error: "Too many requests. Please wait a minute.", code: "RATE_LIMITED" },
          429
        )
      }
    }

    await next()
  }
}
