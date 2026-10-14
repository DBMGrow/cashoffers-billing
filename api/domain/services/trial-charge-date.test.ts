import { describe, it, expect, vi, afterEach } from "vitest"
import { render } from "@react-email/render"
import { createElement } from "react"

import { formatTrialChargeDate, trialFirstChargeDate } from "./trial-charge-date"
import { calculateRenewalDate } from "@api/use-cases/subscription/purchase-helpers"
import TrialWelcomeEmail from "@api/infrastructure/email/templates/trial-welcome.email"
import TrialEndingEmail from "@api/infrastructure/email/templates/trial-ending.email"
import { FIRST_CHARGE_CASES, MACHINE_ZONES, TRIAL_DAYS } from "@api/tests/fixtures/first-charge-instants"

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ
  vi.useRealTimers()
})

/** Rendered HTML with tags stripped, so copy is matched as a reader sees it. */
async function text(element: React.ReactElement): Promise<string> {
  const html = await render(element)
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")
}

describe("trialFirstChargeDate and formatTrialChargeDate (D3, AC26)", () => {
  for (const c of FIRST_CHARGE_CASES) {
    describe(`a signup at ${c.name}`, () => {
      for (const zone of MACHINE_ZONES) {
        it(`names ${c.firstCharge} on a machine in ${zone}`, () => {
          process.env.TZ = zone
          const chargeAt = trialFirstChargeDate(TRIAL_DAYS, new Date(c.signupAt))
          expect(chargeAt.toISOString()).toBe(c.endsAt)
          expect(formatTrialChargeDate(chargeAt)).toBe(c.firstCharge)
          expect(formatTrialChargeDate(c.endsAt)).toBe(c.firstCharge)
        })
      }

      // The review step's estimate is the date the server stores: calculateRenewalDate on a server
      // running in UTC writes renewal_date, and data.trial.ends_at with it.
      it("estimates the same instant the server writes as ends_at", () => {
        process.env.TZ = "UTC"
        vi.useFakeTimers({ toFake: ["Date"] })
        vi.setSystemTime(new Date(c.signupAt))
        expect(calculateRenewalDate("monthly", TRIAL_DAYS).toISOString()).toBe(c.endsAt)
        expect(trialFirstChargeDate(TRIAL_DAYS).toISOString()).toBe(c.endsAt)
      })

      it(`renders ${c.firstCharge} in both emails`, async () => {
        process.env.TZ = c.browserZone
        const date = formatTrialChargeDate(c.endsAt)
        const welcome = await text(
          createElement(TrialWelcomeEmail, {
            trialDays: TRIAL_DAYS,
            expirationDate: date,
            firstCharge: { subscription: "InstantOffers365 Individual", amount: "$250.00" },
          })
        )
        expect(welcome).toContain(`Trial Ends ${c.firstCharge}`)
        expect(welcome).toContain(`$250.00 on ${c.firstCharge}`)

        const ending = await text(
          createElement(TrialEndingEmail, {
            subscription: "InstantOffers365 Individual",
            amount: "$250.00",
            chargeDate: date,
            manageUrl: "https://account.cashoffers.pro/manage",
          })
        )
        expect(ending).toContain(`Your free trial ends on ${c.firstCharge}.`)
        expect(ending).toContain(`Charge Date ${c.firstCharge}`)
      })
    })
  }

  it("keeps a whole number of days across a daylight saving change in the machine's zone", () => {
    process.env.TZ = "America/Los_Angeles"
    // Los Angeles leaves daylight saving on November 1, inside this trial
    const chargeAt = trialFirstChargeDate(30, new Date("2026-10-20T18:00:00.000Z"))
    expect(chargeAt.toISOString()).toBe("2026-11-19T18:00:00.000Z")
  })

  it("names the day of the hourly run that charges, not the day ends_at falls on", () => {
    // A trial ending inside the 23:00 hour is charged by the midnight run
    expect(formatTrialChargeDate("2026-11-11T23:00:00.000Z")).toBe("November 11, 2026")
    expect(formatTrialChargeDate("2026-11-11T23:00:00.001Z")).toBe("November 12, 2026")
    expect(formatTrialChargeDate("2026-11-11T23:30:00.000Z")).toBe("November 12, 2026")
    expect(formatTrialChargeDate("2026-11-12T00:00:00.000Z")).toBe("November 12, 2026")
    expect(formatTrialChargeDate("2026-11-11T22:59:59.999Z")).toBe("November 11, 2026")
    // The year turns over the same way
    expect(formatTrialChargeDate("2026-12-31T23:30:00.000Z")).toBe("January 1, 2027")
  })

  it("returns an empty string for an unparseable date rather than Invalid Date", () => {
    expect(formatTrialChargeDate("soon")).toBe("")
    expect(formatTrialChargeDate(new Date(NaN))).toBe("")
  })
})
