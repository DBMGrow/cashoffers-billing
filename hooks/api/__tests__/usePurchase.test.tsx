import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { usePurchase } from "../usePurchase"

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("usePurchase", () => {
  it("should successfully process a purchase", async () => {
    const mockPurchaseData = {
      data: {
        user: {
          email: "test@example.com",
          user_id: 123,
          api_token: "test-token",
        },
      },
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "success",
            ...mockPurchaseData,
          }),
      })
    ) as any

    const { result } = renderHook(() => usePurchase(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      product_id: 1,
      email: "test@example.com",
      phone: "(123) 456-7890",
      name: "Test User",
      card_token: "tok_test",
      exp_month: 12,
      exp_year: 2025,
      cardholder_name: "Test User",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.success).toBe("success")
  })

  it("should handle purchase errors", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: "error",
            error: "Payment failed",
            code: "PUR08",
          }),
      })
    ) as any

    const { result } = renderHook(() => usePurchase(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      product_id: 1,
      email: "test@example.com",
      phone: "(123) 456-7890",
      name: "Test User",
      card_token: "tok_invalid",
      exp_month: 12,
      exp_year: 2025,
      cardholder_name: "Test User",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.code).toBe("PUR08")
  })
})
