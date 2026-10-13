import type { SubscriptionTrial } from "@api/domain/types/product-data.types"

/**
 * The free-trial marker (Desk #1350) on a subscription's `data`, or null when there is none or it
 * is malformed. `data` arrives as a JSON string from some drivers and as a parsed object from
 * others, so both are accepted. A marker with an unparseable `ends_at` or a non-positive
 * `duration_days` is treated as no trial: an email that names a wrong date is worse than none.
 */
export function readSubscriptionTrial(data: unknown): SubscriptionTrial | null {
  let parsed: unknown = data
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== "object") return null

  const trial = (parsed as { trial?: unknown }).trial
  if (!trial || typeof trial !== "object") return null

  const { ends_at, duration_days, reminder_sent_at } = trial as Record<string, unknown>
  if (typeof ends_at !== "string" || Number.isNaN(Date.parse(ends_at))) return null
  if (typeof duration_days !== "number" || !Number.isInteger(duration_days) || duration_days <= 0) return null

  return {
    ends_at,
    duration_days,
    ...(typeof reminder_sent_at === "string" ? { reminder_sent_at } : {}),
  }
}
