import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import axios from "axios"
import EnrollmentStep from "../steps/EnrollmentStep"

/**
 * CO-I271: an ExpressOffers Guest on the test domain upgrades from the account site with no card.
 * The server already runs that purchase in the Square sandbox, so the production card form cannot
 * tokenize for it; the step skips the card form and sends Square's sandbox test nonce instead.
 */

vi.mock("axios")
// P is a .js file with JSX, which the frontend test transform does not parse.
vi.mock("@/components/Theme/P", () => ({ default: ({ children }: any) => <p>{children}</p> }))
vi.mock("react-square-web-payments-sdk", () => ({
  PaymentForm: ({ children }: any) => <div data-testid="square-card-form">{children}</div>,
  CreditCard: () => <button>Square card</button>,
}))
const mockedAxios = vi.mocked(axios, true)

const proProduct = {
  product_id: 122,
  product_name: "ExpressOffers Pro",
  price: 4900,
  product_type: "subscription",
  data: { duration: "monthly", renewal_cost: 4900 },
}

function renderStep(email: string) {
  const user = { user_id: 42, api_token: "tok", name: "Demo Guest", email } as any
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const handlers = { onSuccess: vi.fn(), onBack: vi.fn(), onError: vi.fn() }
  render(
    <QueryClientProvider client={queryClient}>
      <EnrollmentStep user={user} productId={122} {...handlers} />
    </QueryClientProvider>
  )
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedAxios.get.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/manage/enrollment")) {
      return {
        data: {
          success: "success",
          data: { eligible: true, product_category: null, reason: "", intent: "buy_product", products: [proProduct] },
        },
      }
    }
    throw new Error(`unexpected ${url}`)
  })
  mockedAxios.post.mockResolvedValue({ data: { success: "success", data: {}, environment: "sandbox" } })
})

describe("EnrollmentStep for a test account", () => {
  it("shows the sandbox notice instead of the card form", async () => {
    renderStep("demo@test.cashoffers.com")
    expect(await screen.findByText(/runs in Square's sandbox and no card is charged/)).toBeTruthy()
    expect(screen.queryByTestId("square-card-form")).toBeNull()
    expect(screen.getByRole("status").textContent).not.toMatch(/promo|coupon/i)
  })

  it("sends the sandbox test nonce and asks the server for test mode", async () => {
    const handlers = renderStep("Demo@Test.CashOffers.com")
    fireEvent.click(await screen.findByText("Subscribe"))
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1))
    const [url, body] = mockedAxios.post.mock.calls[0] as [string, any]
    expect(url).toBe("/api/purchase/existing")
    expect(body).toMatchObject({ product_id: 122, card_token: "cnon:card-nonce-ok", mock_purchase: true, coupon: null })
    expect(await screen.findByText(/activated successfully/)).toBeTruthy()
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it("reports a server refusal instead of charging", async () => {
    mockedAxios.post.mockRejectedValue({
      response: { data: { success: "error", code: "TEST_MODE_NOT_ALLOWED", error: "Test purchases aren't available" } },
    })
    const handlers = renderStep("demo@test.cashoffers.com")
    fireEvent.click(await screen.findByText("Subscribe"))
    await waitFor(() =>
      expect(handlers.onError).toHaveBeenCalledWith(
        "Test purchases aren't available",
        expect.anything(),
        expect.anything()
      )
    )
  })
})

describe("EnrollmentStep for an ordinary account", () => {
  it("still shows the Square card form and no sandbox notice", async () => {
    renderStep("agent@example.com")
    expect(await screen.findByTestId("square-card-form")).toBeTruthy()
    expect(screen.queryByText(/Square's sandbox/)).toBeNull()
    expect(screen.queryByText("Subscribe")).toBeNull()
  })

  it("does not treat a look-alike domain as a test account", async () => {
    renderStep("demo@test.cashoffers.com.example.com")
    expect(await screen.findByTestId("square-card-form")).toBeTruthy()
  })
})
