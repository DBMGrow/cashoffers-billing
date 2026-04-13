import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useLogin } from "../useLogin"

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useLogin", () => {
  it("should successfully login with valid credentials", async () => {
    const mockUser = {
      email: "test@example.com",
      name: "Test User",
      api_token: "test-token",
      user_id: 123,
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "success",
            data: mockUser,
          }),
      })
    ) as any

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      email: "test@example.com",
      password: "password123",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.success).toBe("success")
    expect(result.current.data?.data).toEqual(mockUser)
  })

  it("should handle login errors", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "error",
            error: "PWINVALID",
          }),
      })
    ) as any

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      email: "test@example.com",
      password: "wrongpassword",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.success).toBe("error")
  })
})
