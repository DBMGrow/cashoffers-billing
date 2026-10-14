import { describe, it, expect } from "vitest"
import type { CompiledQuery } from "kysely"
import {
  capturingKysely,
  subscriptionUpdates,
  trialEndsAtWritten,
  TRIAL_CARRIED_OVER,
  TRIAL_END_FOLLOWS_RENEWAL,
} from "@api/tests/helpers/capturing-kysely"
import { SubscriptionRepository, withTrialCarriedOver, withTrialRules } from "./subscription.repository"

/**
 * D5 (Desk #1350, AC28): a write that replaces `Subscriptions.data` wholesale keeps an unconverted
 * trial's `data.trial`. The rule is decided by MySQL on the row it updates, so these tests read the
 * statement the repository would send; what MySQL does with it (trial kept, converted and non-trial
 * rows unchanged) is proven on staging against a planted trial (see the card's runbook).
 */

const ROW = { subscription_id: 7, user_id: 1, renewal_date: new Date("2026-11-01T00:00:00.000Z"), data: null }

function repo() {
  const { db, queries } = capturingKysely(() => [ROW])
  return { repo: new SubscriptionRepository(db), db, queries }
}

/** A product's data as the manage route's plan change writes it: no `trial` key. */
const NEW_PRODUCT_DATA = JSON.stringify({
  renewal_cost: 35000,
  duration: "monthly",
  cashoffers: {
    managed: true,
    user_config: { role: "AGENT", role_v2: "AGENT_PREMIUM", is_premium: 1, is_team_plan: false },
  },
})

/** The parameter bound at the n-th `?` of a statement. */
const boundAt = (update: CompiledQuery, sqlBefore: string) => {
  const at = update.sql.indexOf(sqlBefore)
  expect(at).toBeGreaterThan(-1)
  const index = (update.sql.slice(0, at + sqlBefore.length).match(/\?/g) ?? []).length - 1
  return update.parameters[index]
}

describe("SubscriptionRepository.update: a wholesale data write keeps an unconverted trial (D5)", () => {
  it("AC28: a data write without a trial carries the stored trial block in the same statement", async () => {
    const { repo: r, queries } = repo()

    await r.update(7, { data: NEW_PRODUCT_DATA, product_id: 71, updatedAt: new Date() })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(new RegExp("`data` = " + TRIAL_CARRIED_OVER.source))
    // The stored trial comes from the row being updated, not from a read before the write
    expect(update.sql).toContain("JSON_SET(?, '$.trial', JSON_EXTRACT(Subscriptions.data, '$.trial'))")
    // Only when the new document has no trial of its own
    expect(update.sql).toContain("AND JSON_EXTRACT(?, '$.trial') IS NULL")
    // The new product data is the document written, in every branch
    expect(update.parameters.filter((p) => p === NEW_PRODUCT_DATA)).toHaveLength(3)
    // No renewal_date written: no ends_at rewrite
    expect(update.sql).not.toContain("ends_at")
    expect(update.sql).not.toContain("`renewal_date`")
    expect(subscriptionUpdates(queries)).toHaveLength(1)
  })

  it("AC28: a converted or converting trial and a row with no trial get the document exactly as sent (the ELSE branch)", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { data: NEW_PRODUCT_DATA })

    const [update] = subscriptionUpdates(queries)
    // The carry is skipped unless the stored data.trial is an object and the trial has not converted
    expect(update.sql).toContain(
      "CASE WHEN JSON_TYPE(JSON_EXTRACT(Subscriptions.data, '$.trial')) = 'OBJECT' AND NOT EXISTS (SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr.subscription_id = Subscriptions.subscription_id AND trial_pr.request_type = 'RENEWAL' AND ((trial_pr.status = 'COMPLETED' AND trial_pr.amount_charged > 0) OR trial_pr.status IN ('CREATING_SUBSCRIPTION', 'FINALIZING')))"
    )
    expect(boundAt(update, "ELSE ?")).toBe(NEW_PRODUCT_DATA)
  })

  it("AC28 with D1: a plan change that also moves renewal_date carries the trial and sets ends_at to the new date", async () => {
    const { repo: r, queries } = repo()
    const moved = new Date("2026-12-05T09:15:00.000Z")

    await r.update(7, { data: NEW_PRODUCT_DATA, renewal_date: moved, updatedAt: new Date() })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(TRIAL_END_FOLLOWS_RENEWAL)
    // D1 rewrites the D5 document, not the stored one and not the bare new one
    expect(update.sql).toContain("JSON_SET(CASE WHEN JSON_TYPE(JSON_EXTRACT(Subscriptions.data, '$.trial'))")
    expect(update.sql).toContain("END, '$.trial.ends_at', ?)")
    expect(trialEndsAtWritten(update)).toBe("2026-12-05T09:15:00.000Z")
    expect(update.parameters.filter((p) => p === NEW_PRODUCT_DATA)).toHaveLength(9)
  })

  it("a read-modify-write that already carries the trial is not overwritten: the carry needs the new document to have no trial", async () => {
    const { repo: r, queries } = repo()
    const withTrial = JSON.stringify({ trial: { ends_at: "2026-11-01T00:00:00.000Z", duration_days: 30 }, team_id: 4 })

    await r.update(7, { data: withTrial })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toContain("JSON_EXTRACT(?, '$.trial') IS NULL")
    expect(boundAt(update, "JSON_EXTRACT(?, '$.trial') IS NULL")).toBe(withTrial)
  })

  it("data: null is written as null, with no carry", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { data: null })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toBe("update `Subscriptions` set `data` = ? where `subscription_id` = ?")
    expect(update.parameters).toEqual([null, 7])
  })

  it("an update that does not write data is byte-for-byte what it was before D5", async () => {
    const { repo: r, queries } = repo()
    const now = new Date("2026-10-14T12:00:00.000Z")
    await r.update(7, { status: "paused", suspension_date: now, updatedAt: now })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toBe(
      "update `Subscriptions` set `status` = ?, `suspension_date` = ?, `updatedAt` = ? where `subscription_id` = ?"
    )
    expect(update.parameters).toEqual(["paused", now, now, 7])
  })
})

describe("withTrialRules", () => {
  it("leaves every other column and its value as given", () => {
    const now = new Date()
    const out = withTrialRules({
      product_id: 71,
      subscription_name: "Team",
      amount: 35000,
      duration: "monthly",
      data: NEW_PRODUCT_DATA,
      updatedAt: now,
    })
    expect(out).toMatchObject({
      product_id: 71,
      subscription_name: "Team",
      amount: 35000,
      duration: "monthly",
      updatedAt: now,
    })
    expect(typeof out.data).toBe("object")
  })

  it("withTrialCarriedOver returns the update untouched when it writes no data document", () => {
    const update = { status: "active" as const, updatedAt: new Date() }
    expect(withTrialCarriedOver(update)).toBe(update)
    const cleared = { data: null }
    expect(withTrialCarriedOver(cleared)).toBe(cleared)
  })
})
