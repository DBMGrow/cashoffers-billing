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

/**
 * How far apart `ends_at` and `renewal_date` may be before it counts as drift. `renewal_date` is a
 * whole-second DATETIME and `ends_at` keeps the milliseconds of the same `Date`, so equal values can
 * differ by up to half a second once MySQL rounds the column.
 */
export const TRIAL_DATE_DRIFT_TOLERANCE_MS = 1000

export interface TrialDateDrift {
  ends_at: string
  renewal_date: string
}

/**
 * The D1 drift check (Desk #1350): for an unconverted trial, `data.trial.ends_at` must equal
 * `renewal_date`, the date the cron charges on. Returns both dates as ISO when they disagree by more
 * than the tolerance, and null when they agree, when there is no readable trial marker, or when
 * `renewal_date` is missing or unparseable (nothing to compare).
 */
export function trialDateDrift(subscription: {
  data: unknown
  renewal_date: Date | string | null
}): TrialDateDrift | null {
  const trial = readSubscriptionTrial(subscription.data)
  if (!trial || subscription.renewal_date == null) return null
  const renewal = new Date(subscription.renewal_date)
  if (Number.isNaN(renewal.getTime())) return null
  if (Math.abs(Date.parse(trial.ends_at) - renewal.getTime()) <= TRIAL_DATE_DRIFT_TOLERANCE_MS) return null
  return { ends_at: trial.ends_at, renewal_date: renewal.toISOString() }
}
