"use client"

import { useState } from "react"
import type { PromoValidation } from "@/hooks/api/useValidatePromo"

interface PromoCodeFieldProps {
  /** The code currently applied (from `?coupon=` or typed here), or null */
  code: string | null
  validation: PromoValidation | undefined
  isValidating: boolean
  onChange: (code: string | null) => void
}

/**
 * "Have a promo code?" on the checkout screens. Applying a code only asks the server for a quote;
 * the purchase itself re-validates the code and computes the charge.
 */
export default function PromoCodeField({ code, validation, isValidating, onChange }: PromoCodeFieldProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")

  const apply = () => {
    const next = draft.trim().toUpperCase()
    if (!next) return
    onChange(next)
    setDraft("")
    setOpen(false)
  }

  if (code && isValidating) {
    return <p className="text-sm text-default-500 py-2">Checking promo code {code}...</p>
  }

  if (code && validation?.quote) {
    return (
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between rounded-md border border-success/40 bg-success/10 p-3 my-2">
        <p className="text-sm font-medium" data-testid="promo-summary">
          {validation.quote.summary}
        </p>
        <button
          type="button"
          className="text-sm underline text-default-600 self-start sm:self-auto"
          onClick={() => onChange(null)}
        >
          Remove
        </button>
      </div>
    )
  }

  const showInput = open || (!!code && !!validation?.error)

  return (
    <div className="py-2">
      {code && validation?.error && (
        <div className="flex gap-2 justify-between items-start pb-2">
          <p className="text-sm text-danger font-medium" role="alert">
            {code}: {validation.error}
          </p>
          <button type="button" className="text-sm underline text-default-600 shrink-0" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
      {showInput ? (
        <div className="flex gap-2 items-stretch">
          <input
            className="border rounded-md px-3 py-2 text-sm grow min-w-0 bg-transparent border-default-300 uppercase focus:outline-none"
            type="text"
            placeholder="Promo code"
            aria-label="Promo code"
            value={draft}
            maxLength={64}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                apply()
              }
            }}
          />
          <button
            type="button"
            className="rounded-md px-4 py-2 text-sm font-medium text-white bg-primary shadow disabled:opacity-50"
            disabled={!draft.trim()}
            onClick={apply}
          >
            Apply
          </button>
        </div>
      ) : (
        <button type="button" className="text-sm underline text-default-600" onClick={() => setOpen(true)}>
          Have a promo code?
        </button>
      )}
    </div>
  )
}
