import { describe, it, expect, vi } from "vitest"
import { isTransientHttpError, withHttpRetry } from "./http-retry"

// Build an axios-like error for assertions.
function axiosError(opts: { status?: number; code?: string } = {}): any {
  const err: any = new Error(opts.status ? `Request failed with status code ${opts.status}` : "network error")
  err.isAxiosError = true
  if (opts.code) err.code = opts.code
  if (opts.status) err.response = { status: opts.status }
  return err
}

describe("isTransientHttpError", () => {
  it("treats Cloudflare 522 (and other 5xx) as transient", () => {
    expect(isTransientHttpError(axiosError({ status: 522 }))).toBe(true)
    expect(isTransientHttpError(axiosError({ status: 500 }))).toBe(true)
    expect(isTransientHttpError(axiosError({ status: 503 }))).toBe(true)
  })

  it("treats 429 as transient", () => {
    expect(isTransientHttpError(axiosError({ status: 429 }))).toBe(true)
  })

  it("treats network-level failures (no response) as transient", () => {
    expect(isTransientHttpError(axiosError({ code: "ECONNABORTED" }))).toBe(true)
    expect(isTransientHttpError(axiosError({ code: "ETIMEDOUT" }))).toBe(true)
    expect(isTransientHttpError(axiosError())).toBe(true)
  })

  it("does NOT retry 4xx caller errors (except 429)", () => {
    expect(isTransientHttpError(axiosError({ status: 400 }))).toBe(false)
    expect(isTransientHttpError(axiosError({ status: 401 }))).toBe(false)
    expect(isTransientHttpError(axiosError({ status: 404 }))).toBe(false)
  })

  it("does NOT retry plain non-axios errors", () => {
    expect(isTransientHttpError(new Error("Invalid API response format"))).toBe(false)
    expect(isTransientHttpError(undefined)).toBe(false)
  })
})

describe("withHttpRetry", () => {
  const fastOpts = { baseDelayMs: 0 }

  it("retries a transient 522 then succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(axiosError({ status: 522 }))
      .mockResolvedValueOnce("ok")

    const result = await withHttpRetry(op, fastOpts)

    expect(result).toBe("ok")
    expect(op).toHaveBeenCalledTimes(2)
  })

  it("gives up after maxAttempts and throws the last error", async () => {
    const op = vi.fn().mockRejectedValue(axiosError({ status: 522 }))

    await expect(withHttpRetry(op, { ...fastOpts, maxAttempts: 3 })).rejects.toThrow("522")
    expect(op).toHaveBeenCalledTimes(3)
  })

  it("does not retry a non-transient 404", async () => {
    const op = vi.fn().mockRejectedValue(axiosError({ status: 404 }))

    await expect(withHttpRetry(op, fastOpts)).rejects.toThrow("404")
    expect(op).toHaveBeenCalledTimes(1)
  })

  it("invokes onRetry before each backoff", async () => {
    const onRetry = vi.fn()
    const op = vi
      .fn()
      .mockRejectedValueOnce(axiosError({ status: 503 }))
      .mockResolvedValueOnce("ok")

    await withHttpRetry(op, { ...fastOpts, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }))
  })
})
