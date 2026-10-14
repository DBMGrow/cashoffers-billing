/**
 * AC26 (D3, #1402): the signup instants the review step, the trial-welcome email and the
 * trial-ending email are all tested against, with the one date each must name. The frontend
 * (review step) and api (emails) suites import this same table, so the three cannot drift apart.
 *
 * `firstCharge` is the UTC calendar day of the first hourly renewal run at or after signup + 30
 * days: the day the cron charges on. `browserZone` is where the agent signed up.
 */
export const TRIAL_DAYS = 30

export interface FirstChargeCase {
  name: string
  /** The signup instant */
  signupAt: string
  /** The agent's zone at signup */
  browserZone: string
  /** `data.trial.ends_at` as the server writes it: signup + TRIAL_DAYS days */
  endsAt: string
  /** The date all three surfaces must name */
  firstCharge: string
}

export const FIRST_CHARGE_CASES: FirstChargeCase[] = [
  {
    // October 12 at 23:30 in Los Angeles is already October 13 in UTC
    name: "23:30 in America/Los_Angeles",
    signupAt: "2026-10-13T06:30:00.000Z",
    browserZone: "America/Los_Angeles",
    endsAt: "2026-11-12T06:30:00.000Z",
    firstCharge: "November 12, 2026",
  },
  {
    // October 13 at 00:30 in Manila is still October 12 in UTC
    name: "00:30 in Asia/Manila",
    signupAt: "2026-10-12T16:30:00.000Z",
    browserZone: "Asia/Manila",
    endsAt: "2026-11-11T16:30:00.000Z",
    firstCharge: "November 11, 2026",
  },
  {
    name: "exactly at a UTC midnight",
    signupAt: "2026-10-13T00:00:00.000Z",
    browserZone: "America/Phoenix",
    endsAt: "2026-11-12T00:00:00.000Z",
    firstCharge: "November 12, 2026",
  },
  {
    // Ends at 23:59:59.999 UTC, so the 23:00 run is too early and the midnight run charges it
    name: "the last millisecond before a UTC midnight",
    signupAt: "2026-10-12T23:59:59.999Z",
    browserZone: "America/New_York",
    endsAt: "2026-11-11T23:59:59.999Z",
    firstCharge: "November 12, 2026",
  },
  {
    // Ends exactly on the 23:00 UTC run, which charges it that day
    name: "exactly 23:00 UTC",
    signupAt: "2026-10-12T23:00:00.000Z",
    browserZone: "America/Los_Angeles",
    endsAt: "2026-11-11T23:00:00.000Z",
    firstCharge: "November 11, 2026",
  },
]

/** Zones the machine (browser or server) is switched through, so no result depends on one. */
export const MACHINE_ZONES = ["UTC", "America/Los_Angeles", "America/Phoenix", "America/New_York", "Asia/Manila"]
