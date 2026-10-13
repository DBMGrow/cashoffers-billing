import { describe, it, expect } from "vitest"
import { render } from "@react-email/render"
import { createElement } from "react"

import TrialEndingEmail from "./trial-ending.email"
import TrialWelcomeEmail from "./trial-welcome.email"
import { CHARGE_NOTICE } from "./components/email-footer"
import { readSubscriptionTrial } from "@api/domain/services/subscription-trial"

/** Rendered HTML with tags stripped and entities decoded, so copy can be matched as a reader sees it. */
async function text(element: React.ReactElement): Promise<string> {
  const html = await render(element)
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/\s+/g, " ")
}

describe("trial-ending email (Desk #1350)", () => {
  const props = {
    subscription: "InstantOffers365 Individual",
    amount: "$250.00",
    chargeDate: "November 11, 2026",
    cardLast4: "4242",
    manageUrl: "https://account.cashoffers.pro/manage",
  }

  it("names the date, the plan's amount, the card and how to cancel", async () => {
    const copy = await text(createElement(TrialEndingEmail, props))
    expect(copy).toContain("Your free trial ends on November 11, 2026.")
    expect(copy).toContain("We'll charge $250.00 to the card ending 4242 that day")
    expect(copy).toContain("To cancel before then")
    expect(copy).toContain(CHARGE_NOTICE)
    expect(copy).not.toContain("—")
    expect(await render(createElement(TrialEndingEmail, props))).toContain(
      'href="https://account.cashoffers.pro/manage"'
    )
  })

  it("falls back to the card on file when no last four is known", async () => {
    const copy = await text(createElement(TrialEndingEmail, { ...props, cardLast4: undefined }))
    expect(copy).toContain("We'll charge $250.00 to your card on file that day")
    expect(copy).not.toContain("Ending in")
  })

  it("carries the whitelabel name and the sandbox banner", async () => {
    const html = await render(
      createElement(TrialEndingEmail, { ...props, isSandbox: true, whitelabel: { name: "InstantOffers" } as any })
    )
    expect(html).toContain("InstantOffers")
    expect(html.toLowerCase()).toContain("sandbox")
  })
})

describe("trial-welcome email", () => {
  it("names the first charge for a card trial, with no HomeUptick upgrade copy", async () => {
    const copy = await text(
      createElement(TrialWelcomeEmail, {
        trialDays: 30,
        expirationDate: "November 11, 2026",
        firstCharge: { subscription: "InstantOffers365 Individual", amount: "$250.00" },
      })
    )
    expect(copy).toContain("30-day free trial")
    expect(copy).toContain("$250.00 on November 11, 2026")
    expect(copy).toContain("reminder 7 days before")
    expect(copy).not.toContain("HomeUptick")
    expect(copy).not.toContain("upgrade to a paid plan")
    expect(copy).not.toContain("—")
  })

  it("keeps the HomeUptick copy when there is no first charge", async () => {
    const copy = await text(createElement(TrialWelcomeEmail, { trialDays: 90, expirationDate: "June 15, 2026" }))
    expect(copy).toContain("HomeUptick")
    expect(copy).toContain("upgrade to a paid plan")
  })
})

describe("readSubscriptionTrial", () => {
  const trial = { ends_at: "2026-11-11T20:00:00.000Z", duration_days: 30 }

  it("reads the marker from a JSON string or an object", () => {
    expect(readSubscriptionTrial(JSON.stringify({ trial }))).toEqual(trial)
    expect(readSubscriptionTrial({ trial: { ...trial, reminder_sent_at: "2026-11-04T20:00:00.000Z" } })).toEqual({
      ...trial,
      reminder_sent_at: "2026-11-04T20:00:00.000Z",
    })
  })

  it("is null for no marker or a malformed one", () => {
    expect(readSubscriptionTrial(null)).toBeNull()
    expect(readSubscriptionTrial("not json")).toBeNull()
    expect(readSubscriptionTrial({ productData: {} })).toBeNull()
    expect(readSubscriptionTrial({ trial: { ...trial, ends_at: "soon" } })).toBeNull()
    expect(readSubscriptionTrial({ trial: { ...trial, duration_days: 0 } })).toBeNull()
  })
})
