import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import type { Product } from "@/providers/ProductProvider"
import ReviewStep from "../steps/ReviewStep"
import { formatTrialChargeDate } from "@/api/domain/services/trial-charge-date"
import { FIRST_CHARGE_CASES, MACHINE_ZONES, TRIAL_DAYS } from "@/api/tests/fixtures/first-charge-instants"

const mocks = vi.hoisted(() => ({
  product: undefined as unknown,
  validatePromo: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Plain .js/.jsx components carry JSX the frontend vitest transform does not parse; stand-ins keep
// the footer (what this test reads) and drop the consents that pull them in (not what this reads).
vi.mock("@/components/Theme/Table", () => ({
  default: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => (
    <>
      <div>{children}</div>
      <div>{footer}</div>
    </>
  ),
}))
vi.mock("@/components/UI/SignupForm/InvestorConsent", () => ({ default: () => null }))
vi.mock("@/components/UI/SignupForm/CommunicationConsent", () => ({ default: () => null }))

vi.mock("@/hooks/api/usePurchase", () => ({
  usePurchase: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/api/useValidatePromo", () => ({
  useValidatePromo: (...args: unknown[]) => mocks.validatePromo(...args),
}))

vi.mock("@/providers/ProductProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/providers/ProductProvider")>()
  return {
    ...actual,
    useProducts: () => ({ getProductById: () => mocks.product }),
  }
})

const NOW = new Date("2026-10-12T15:00:00Z")

function product(data: Record<string, unknown>): Product {
  return {
    product_id: 70,
    product_name: "InstantOffers365 Individual",
    product_description: null,
    product_type: "subscription",
    price: 0,
    active: 1,
    data: { renewal_cost: 25000, signup_fee: 0, duration: "monthly", ...data } as Product["data"],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

const PROMO_QUOTE = {
  valid: true as const,
  code: "EXPCON",
  display: "First month free",
  summary: "Promo EXPCON: First month free, $0.00 today, then $250.00/mo",
  original_amount: 25000,
  discount_amount: 25000,
  charged_amount: 0,
  then_amount: 25000,
}

function Harness({ coupon = null }: { coupon?: string | null }) {
  const form = useForm<SubscribeFormData>({
    defaultValues: {
      product: 70,
      email: "agent@example.com",
      name: "Pat Agent",
      phone: "5551234567",
      coupon,
      cardData: null,
    } as Partial<SubscribeFormData> as SubscribeFormData,
  })
  return (
    <ReviewStep
      form={form}
      onNext={vi.fn()}
      onBack={vi.fn()}
      onError={vi.fn()}
      onCardError={vi.fn()}
      setAllowReset={vi.fn()}
    />
  )
}

/** The footer row whose label is `label`, so a value is read from its own row. */
function footerRow(label: string): HTMLElement {
  return screen.getByText(label, { selector: "strong" }).parentElement as HTMLElement
}

describe("ReviewStep on a free trial product (AC6)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    mocks.validatePromo.mockReset()
    mocks.validatePromo.mockImplementation((code: string | null) => ({
      data: code ? { quote: PROMO_QUOTE, error: null } : undefined,
      isFetching: false,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows $0 due today, then the plan's price from the day the trial ends", () => {
    mocks.product = product({ trial: { enabled: true, duration_days: 30, require_card: true } })
    render(<Harness />)

    expect(within(footerRow("Due today")).getByText("$0")).toBeTruthy()
    expect(screen.queryByText("Total Today")).toBeNull()
    expect(within(footerRow("Then")).getByText("$250/mo starting November 11, 2026")).toBeTruthy()
  })

  it("hides the promo code and its discount, and does not quote a coupon", () => {
    mocks.product = product({ trial: { enabled: true, duration_days: 30, require_card: true } })
    render(<Harness coupon="EXPCON" />)

    expect(screen.queryByTestId("promo-summary")).toBeNull()
    expect(screen.queryByText("Promo EXPCON")).toBeNull()
    expect(mocks.validatePromo).toHaveBeenCalledWith(null, 70, "signup")
    expect(within(footerRow("Due today")).getByText("$0")).toBeTruthy()
  })

  it("does not show a signup fee the trial does not charge", () => {
    mocks.product = product({ signup_fee: 5000, trial: { enabled: true, duration_days: 14, require_card: true } })
    render(<Harness />)

    expect(screen.queryByText("Signup Fee")).toBeNull()
    expect(within(footerRow("Then")).getByText("$250/mo starting October 26, 2026")).toBeTruthy()
  })

  it("leaves the footer unchanged on a product without a trial", () => {
    mocks.product = product({})
    render(<Harness coupon="EXPCON" />)

    expect(within(footerRow("Total Today")).getByText("$0.00")).toBeTruthy()
    expect(screen.getByText("Promo EXPCON")).toBeTruthy()
    expect(screen.getByTestId("promo-summary")).toBeTruthy()
    expect(screen.queryByText("Due today")).toBeNull()
    expect(screen.queryByTestId("trial-first-charge")).toBeNull()
  })

  // D3, AC26: the review step names the UTC day the cron charges on, the same date both trial emails
  // name (same table: api/tests/fixtures/first-charge-instants.ts), whatever the browser's zone.
  describe("names the first-charge date the emails name (D3, AC26)", () => {
    const ORIGINAL_TZ = process.env.TZ
    afterEach(() => {
      process.env.TZ = ORIGINAL_TZ
    })

    for (const c of FIRST_CHARGE_CASES) {
      for (const zone of [...new Set([c.browserZone, ...MACHINE_ZONES])]) {
        it(`a signup at ${c.name}, in a browser in ${zone}: ${c.firstCharge}`, () => {
          process.env.TZ = zone
          vi.setSystemTime(new Date(c.signupAt))
          mocks.product = product({ trial: { enabled: true, duration_days: TRIAL_DAYS, require_card: true } })
          render(<Harness />)

          expect(within(footerRow("Then")).getByText(`$250/mo starting ${c.firstCharge}`)).toBeTruthy()
          expect(formatTrialChargeDate(c.endsAt)).toBe(c.firstCharge)
        })
      }
    }
  })

  it("treats a disabled trial as no trial", () => {
    mocks.product = product({ signup_fee: 5000, trial: { enabled: false, duration_days: 30, require_card: true } })
    render(<Harness />)

    expect(within(footerRow("Signup Fee")).getByText("$50")).toBeTruthy()
    expect(within(footerRow("Total Today")).getByText("$300")).toBeTruthy()
    expect(screen.queryByTestId("trial-first-charge")).toBeNull()
  })
})
