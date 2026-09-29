import { useQuery } from "@tanstack/react-query"
import axios from "axios"

/** What GET /api/purchase/promo/validate returns for a code that applies. Amounts in cents. */
export interface PromoQuote {
  valid: true
  code: string
  /** e.g. "First month free" */
  display: string
  /** e.g. "Promo EXPCON: First month free, $0.00 today, then $49.00/mo" */
  summary: string
  original_amount: number
  discount_amount: number
  charged_amount: number
  then_amount: number
}

export interface PromoValidation {
  quote: PromoQuote | null
  /** Customer-facing reason when the code does not apply */
  error: string | null
}

/**
 * Quotes a promo code for a product. Display only: the purchase re-validates on the server and
 * never trusts this number. `flow` picks the pricing rule (new signup vs existing account).
 */
export function useValidatePromo(
  code: string | null | undefined,
  productId: number | string | null | undefined,
  flow: "signup" | "manage"
) {
  const normalized = code?.trim().toUpperCase() || null
  const numericProductId = typeof productId === "number" ? productId : Number(productId)
  return useQuery<PromoValidation>({
    queryKey: ["validatePromo", normalized, numericProductId, flow],
    queryFn: async () => {
      const { data } = await axios.get("/api/purchase/promo/validate", {
        params: { code: normalized, product_id: numericProductId, flow },
        validateStatus: () => true,
      })
      if (data?.success === "success" && data.data?.valid) return { quote: data.data as PromoQuote, error: null }
      return { quote: null, error: data?.error || "That promo code isn't valid." }
    },
    enabled: !!normalized && Number.isInteger(numericProductId) && numericProductId > 0,
    retry: false,
    staleTime: 60_000,
  })
}
