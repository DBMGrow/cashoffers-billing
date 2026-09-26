import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import axios from "axios"
import UpdatePlanStep from "../steps/UpdatePlanStep"

vi.mock("axios")
// P and Table are .js files with JSX, which the frontend test transform does not parse.
vi.mock("@/components/Theme/P", () => ({ default: ({ children }: any) => <p>{children}</p> }))
vi.mock("@/components/Theme/Table", () => ({ default: ({ children }: any) => <div>{children}</div> }))
const mockedAxios = vi.mocked(axios, true)

const user = { user_id: 42, api_token: "tok", name: "Guest", email: "g@exp.test" } as any

function renderStep(props: Partial<Parameters<typeof UpdatePlanStep>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const handlers = { onNoSubscription: vi.fn(), onBack: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() }
  render(
    <QueryClientProvider client={queryClient}>
      <UpdatePlanStep user={user} {...handlers} {...props} />
    </QueryClientProvider>
  )
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: "success", data: [] }) })) as any
})

describe("UpdatePlanStep without a subscription", () => {
  beforeEach(() => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url === "/api/subscription/single") return { data: { success: "success", data: { subscriptions: [] } } }
      if (url.startsWith("/api/manage/products")) return { data: { success: "success", data: [{ product_id: 70 }] } }
      throw new Error(`unexpected ${url}`)
    })
  })

  it("hands off to enrollment on the linked product instead of spinning", async () => {
    const handlers = renderStep({ productId: 70 })
    await waitFor(() => expect(handlers.onNoSubscription).toHaveBeenCalledTimes(1))
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it("hands off to enrollment without a linked product too", async () => {
    const handlers = renderStep()
    await waitFor(() => expect(handlers.onNoSubscription).toHaveBeenCalledTimes(1))
  })
})

describe("UpdatePlanStep when the subscription cannot be loaded", () => {
  it("says so rather than spinning, and does not treat it as no subscription", async () => {
    mockedAxios.get.mockResolvedValue({ data: { success: "error" } })
    const handlers = renderStep({ productId: 70 })
    expect(await screen.findByText(/error loading your subscription/i)).toBeTruthy()
    expect(handlers.onNoSubscription).not.toHaveBeenCalled()
  })
})
