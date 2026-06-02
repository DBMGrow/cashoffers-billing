import type { AxiosError } from "axios"

/**
 * Default per-request timeout for outbound calls to external APIs.
 * Without this, axios waits indefinitely and a hung origin can stall a
 * renewal/provisioning handler forever.
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 15_000

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  /** Called before each backoff sleep (for logging/observability). */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
}

/**
 * Decide whether an error from an axios call is worth retrying.
 *
 * Transient = the request never reached a healthy origin and a later attempt
 * has a good chance of succeeding:
 *   - network-level failures (timeout, reset, DNS) — no response at all
 *   - 429 Too Many Requests
 *   - any 5xx, including Cloudflare's 520-524 (e.g. 522 origin timeout)
 *
 * 4xx (other than 429) are caller/state errors and are NOT retried.
 */
export function isTransientHttpError(error: unknown): boolean {
  const err = error as AxiosError | undefined
  if (!err || typeof err !== "object") return false

  // Network-level failures surface as an error code with no response.
  const code = (err as AxiosError).code
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return true
  }
  if ((err as AxiosError).isAxiosError && !err.response) {
    return true
  }

  const status = err.response?.status
  if (typeof status === "number") {
    return status === 429 || status >= 500
  }
  return false
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Run an async HTTP operation with exponential backoff retry on transient
 * failures. Non-transient errors (4xx, parse errors) throw immediately.
 */
export async function withHttpRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 500

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !isTransientHttpError(error)) {
        throw error
      }
      // Exponential backoff with a little jitter to avoid thundering herd.
      const delayMs = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100)
      options.onRetry?.({ attempt, delayMs, error })
      await sleep(delayMs)
    }
  }
  throw lastError
}
