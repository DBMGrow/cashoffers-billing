/**
 * The first-charge date of a card-on-file free trial (Desk #1350), as the agent reads it.
 *
 * The renewal cron runs at the top of every hour (`0 * * * *`, cashoffers-cron `src/jobs.ts`) and
 * charges a subscription once `renewal_date <= now`; until a trial converts, `data.trial.ends_at`
 * equals `renewal_date` (D1). So the trial is charged by the first hourly run at or after
 * `ends_at`, and the day we name is that run's UTC calendar day. The signup review step, the
 * trial-welcome email and the trial-ending email all format through `formatTrialChargeDate`, so
 * they name the same day whatever zone the browser or the server runs in. Before this, the review
 * step used the browser's zone and the emails the server's, so a signup late in the evening in the
 * Americas (or early morning in Asia) saw one day on the page and another in the email (D3, #1402).
 *
 * No imports on purpose: the Next app bundles this file for the review step.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** How often the renewal cron runs: hourly, on the hour (UTC hours are whole multiples of this). */
export const RENEWAL_RUN_INTERVAL_MS = 60 * 60 * 1000

/**
 * When a trial that starts at `now` ends: exactly `trialDays` days later, the same instant
 * `calculateRenewalDate` writes as `renewal_date` and `ends_at` on the server (which runs in UTC).
 * Whole days are added in milliseconds, so a daylight saving change in the browser's zone cannot
 * move it by an hour.
 */
export function trialFirstChargeDate(trialDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + trialDays * DAY_MS)
}

/**
 * The first-charge date as the agent reads it, e.g. "November 11, 2026": the UTC calendar day of
 * the first hourly renewal run at or after `endsAt`. A trial ending at 23:30 UTC is charged by the
 * midnight run, so it names the next day. Accepts a `Date` or an ISO string such as
 * `data.trial.ends_at`. An unparseable value returns "" rather than "Invalid Date".
 */
export function formatTrialChargeDate(endsAt: Date | string): string {
  const time = (typeof endsAt === "string" ? new Date(endsAt) : endsAt).getTime()
  if (Number.isNaN(time)) return ""
  const chargedAt = new Date(Math.ceil(time / RENEWAL_RUN_INTERVAL_MS) * RENEWAL_RUN_INTERVAL_MS)
  return chargedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}
