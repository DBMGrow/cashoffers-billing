import type { EnrollmentIntent } from "@/api/domain/services/enrollment-intent.service"
import { homeUptickAllowance } from "@/api/domain/services/homeuptick-allowance"
import type { HomeUptickConfig } from "@/api/domain/types/product-data.types"

/**
 * Pure helpers for the manage flow's enrollment step. The server decides what an enrollment is for
 * (`intent` on `GET /manage/enrollment`, see enrollment-intent.service.ts); these read it, so the
 * copy and the routing never re-derive it from the product category.
 */

export type { EnrollmentIntent }

export interface EnrollmentResponse {
  eligible: boolean
  product_category: string | null
  reason: string
  intent: EnrollmentIntent | null
  products: unknown[]
}

export const ENROLLMENT_TITLE = "Get Started"

/** The enrollment description before the step knows its intent. Neutral, so a Guest never sees HomeUptick copy. */
export const ENROLLMENT_DEFAULT_DESCRIPTION = "Add your card on file to get started."

const HOMEUPTICK_DESCRIPTION = "Add your card on file to activate HomeUptick."

/**
 * The enrollment step's title and description for an intent. HomeUptick copy only for the two
 * HomeUptick intents; buying a plan names the plan when there is one to name.
 */
export function enrollmentCopy(
  intent: EnrollmentIntent | null | undefined,
  productName: string | null | undefined
): { title: string; description: string } {
  switch (intent) {
    case "buy_product":
      return {
        title: ENROLLMENT_TITLE,
        description: productName
          ? `Add your card to start ${productName}.`
          : "Choose a plan, then add your card to start it.",
      }
    case "homeuptick_only":
    case "activate_homeuptick":
      return { title: ENROLLMENT_TITLE, description: HOMEUPTICK_DESCRIPTION }
    default:
      return { title: ENROLLMENT_TITLE, description: ENROLLMENT_DEFAULT_DESCRIPTION }
  }
}

/**
 * Whether plain `/manage` (no `goto`) should open on enrollment instead of the dashboard: only
 * when the server named an intent and offered something to buy. A Guest with no single upgrade
 * product comes back `eligible: false`, so they land on the dashboard, never on HomeUptick-only.
 */
export function shouldAutoEnroll(
  response: { success?: string; data?: Partial<EnrollmentResponse> | null } | null
): boolean {
  const data = response?.success === "success" ? response.data : null
  return Boolean(data?.eligible && data.intent && (data.products?.length ?? 0) > 0)
}

export interface HomeUptickLine {
  label: string
  value: string
}

function dollars(cents: number): string {
  const amount = cents / 100
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

/**
 * The contact lines under a plan's price: none when the plan does not turn HomeUptick on, none
 * when it includes no contacts (ExpressOffers Pro: a per-contact rate is noise at the moment of
 * upgrading, David, 2026-09-29), and the included plus overage pair otherwise.
 */
export function homeUptickLines(
  homeuptick: Partial<HomeUptickConfig> | null | undefined,
  period: string
): HomeUptickLine[] {
  const allowance = homeUptickAllowance(homeuptick)
  if (!allowance) return []
  if (allowance.included === 0) return []
  const perTier = allowance.perTier.toLocaleString()
  const tierPrice = dollars(allowance.tierPrice)
  return [
    { label: "Included", value: `${allowance.included.toLocaleString()} contacts` },
    { label: "Overage", value: `${tierPrice} / ${period} per additional ${perTier} contacts` },
  ]
}
