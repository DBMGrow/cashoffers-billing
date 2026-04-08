import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useCheckUserExists } from "../useCheckUserExists"

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useCheckUserExists", () => {
  it("should return null when email is null", () => {
    const { result } = renderHook(() => useCheckUserExists(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it("should check if user exists", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "success",
            data: { userExists: true, hasCard: true },
          }),
      })
    ) as any

    const { result } = renderHook(() => useCheckUserExists("test@example.com"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.userExists).toBe(true)
    expect(result.current.data?.hasCard).toBe(true)
  })

  it("should handle API errors", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "error",
          }),
      })
    ) as any

    const { result } = renderHook(() => useCheckUserExists("test@example.com"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
