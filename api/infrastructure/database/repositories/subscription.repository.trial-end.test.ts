import { describe, it, expect } from "vitest"
import {
  capturingKysely,
  subscriptionUpdates,
  trialEndsAtWritten,
  reminderKeptWithin,
  TRIAL_END_FOLLOWS_RENEWAL,
  TRIAL_CARRIED_OVER,
} from "@api/tests/helpers/capturing-kysely"
import { SubscriptionRepository } from "./subscription.repository"

/**
 * D1 (Desk #1350): a card-on-file trial's `data.trial.ends_at` follows `renewal_date` until the
 * trial converts. `SubscriptionRepository.update` is the choke point every billing writer of
 * `renewal_date` passes through; these tests read the statement it sends. The MySQL semantics of
 * that statement were proven against staging (see the card's runbook).
 */

const ROW = { subscription_id: 7, user_id: 1, renewal_date: new Date("2026-11-01T00:00:00.000Z"), data: null }

function repo() {
  const { db, queries } = capturingKysely(() => [ROW])
  return { repo: new SubscriptionRepository(db), queries }
}

describe("SubscriptionRepository.update: trial end follows renewal_date (D1)", () => {
  it("AC20: a write of renewal_date rewrites data.trial.ends_at to the same instant, in the same statement", async () => {
    const { repo: r, queries } = repo()
    const moved = new Date("2026-11-20T15:30:00.000Z")

    await r.update(7, { renewal_date: moved, updatedAt: new Date() })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(TRIAL_END_FOLLOWS_RENEWAL)
    // The statement's own `data` column is the document rewritten (no read-modify-write)
    expect(update.sql).toContain("JSON_SET(`Subscriptions`.`data`, '$.trial.ends_at', ?)")
    expect(update.sql).toContain("`renewal_date` = ?")
    expect(update.sql).toMatch(/where `subscription_id` = \?$/)
    expect(trialEndsAtWritten(update)).toBe("2026-11-20T15:30:00.000Z")
    expect(subscriptionUpdates(queries)).toHaveLength(1)
  })

  it("AC23: the rewrite is skipped for a converted trial (completed paid RENEWAL) and while one is converting", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { renewal_date: new Date("2026-12-01T00:00:00.000Z") })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toContain(
      "AND NOT EXISTS (SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr.subscription_id = Subscriptions.subscription_id AND trial_pr.request_type = 'RENEWAL' AND ((trial_pr.status = 'COMPLETED' AND trial_pr.amount_charged > 0) OR trial_pr.status IN ('CREATING_SUBSCRIPTION', 'FINALIZING')))"
    )
    expect(update.sql).toContain("ELSE `Subscriptions`.`data` END")
  })

  it("a row with no trial object keeps its data: the rewrite only applies when data.trial is a JSON object", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { renewal_date: new Date("2026-12-01T00:00:00.000Z") })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toContain("CASE WHEN JSON_TYPE(JSON_EXTRACT(`Subscriptions`.`data`, '$.trial')) = 'OBJECT'")
  })

  it("when the same update writes data too (the renewal writes the whole row), the new data is the document rewritten", async () => {
    const { repo: r, queries } = repo()
    const data = JSON.stringify({ trial: { ends_at: "2026-11-01T00:00:00.000Z", duration_days: 30 } })

    await r.update(7, { renewal_date: new Date("2026-12-01T00:00:00.000Z"), data })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(TRIAL_END_FOLLOWS_RENEWAL)
    expect(update.sql).not.toContain("`Subscriptions`.`data`, '$.trial'")
    // D5 wraps the written document once (3 bindings), and D1 uses that rewrite three times
    expect(update.parameters.filter((p) => p === data)).toHaveLength(9)
    expect(trialEndsAtWritten(update)).toBe("2026-12-01T00:00:00.000Z")
  })

  it("an update that does not write renewal_date leaves data alone", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { status: "paused", suspension_date: new Date(), updatedAt: new Date() })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).not.toContain("JSON_SET")
    expect(update.sql).not.toContain("`data`")
  })

  it("an update that writes data but not renewal_date gets only the D5 carry-over, no ends_at rewrite", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { data: JSON.stringify({ team_id: 4 }) })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).not.toContain("ends_at")
    expect(update.sql).toMatch(
      new RegExp(
        "^update `Subscriptions` set `data` = " + TRIAL_CARRIED_OVER.source + " where `subscription_id` = \\?$"
      )
    )
  })

  it("updateRenewalDate goes through the same rewrite", async () => {
    const { repo: r, queries } = repo()
    await r.updateRenewalDate(7, new Date("2027-01-05T08:00:00.000Z"))

    const [update] = subscriptionUpdates(queries)
    expect(trialEndsAtWritten(update)).toBe("2027-01-05T08:00:00.000Z")
  })

  it("a renewal_date given as a string is written to ends_at as the same ISO instant", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { renewal_date: "2027-02-01T10:00:00Z" as any })

    expect(trialEndsAtWritten(subscriptionUpdates(queries)[0])).toBe("2027-02-01T10:00:00.000Z")
  })

  // D6, AC29: a trial paused after its reminder and reactivated later must be reminded again before
  // the new date. The rewrite removes `reminder_sent_at` when the stored end moves, and keeps it when
  // the stored end is within the drift tolerance of the new date.
  it("AC29: moving the trial end clears reminder_sent_at; the stamp survives only a write of the same date (within 1s)", async () => {
    const { repo: r, queries } = repo()
    const moved = new Date("2026-12-14T12:00:00.000Z")

    await r.update(7, { status: "active", suspension_date: null, renewal_date: moved })

    const [update] = subscriptionUpdates(queries)
    expect(update.sql).toMatch(TRIAL_END_FOLLOWS_RENEWAL)
    expect(update.sql).toContain(
      "IF(JSON_UNQUOTE(JSON_EXTRACT(Subscriptions.data, '$.trial.ends_at')) BETWEEN ? AND ?, '{}', '{\"trial\":{\"reminder_sent_at\":null}}')"
    )
    // The stored end is compared with the new date, a second either side (MySQL rounds renewal_date)
    expect(reminderKeptWithin(update)).toEqual(["2026-12-14T11:59:59.000Z", "2026-12-14T12:00:01.000Z"])
    expect(trialEndsAtWritten(update)).toBe("2026-12-14T12:00:00.000Z")
  })

  it("AC29: the reminder reset is inside the unconverted-trial branch, so a converted subscription's data is untouched", async () => {
    const { repo: r, queries } = repo()
    await r.update(7, { renewal_date: new Date("2026-12-14T12:00:00.000Z") })

    const [update] = subscriptionUpdates(queries)
    const thenAt = update.sql.indexOf(" THEN JSON_MERGE_PATCH(")
    const elseAt = update.sql.lastIndexOf(" ELSE `Subscriptions`.`data` END")
    expect(thenAt).toBeGreaterThan(update.sql.indexOf("AND NOT EXISTS (SELECT 1 FROM PurchaseRequests AS trial_pr"))
    expect(update.sql.indexOf("reminder_sent_at")).toBeGreaterThan(thenAt)
    expect(update.sql.indexOf("reminder_sent_at")).toBeLessThan(elseAt)
  })
})

describe("SubscriptionRepository trial queries (D1)", () => {
  const NOW = new Date("2026-10-12T12:00:00.000Z")

  it("AC22: the reconciliation also requires renewal_date to have passed the cutoff", async () => {
    const { repo: r, queries } = repo()
    await r.findEndedTrialsUnreconciled(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain("`Subscriptions`.`renewal_date` < ?")
    expect(parameters[1]).toEqual(new Date("2026-10-11T12:00:00.000Z"))
  })

  it("AC24: findUnconvertedTrials reads trial rows that are not cancelled and have not converted or begun converting", async () => {
    const { repo: r, queries } = repo()
    await r.findUnconvertedTrials()

    const [{ sql, parameters }] = queries
    expect(sql.startsWith("select ")).toBe(true)
    expect(sql).toContain("JSON_TYPE(JSON_EXTRACT(Subscriptions.data, '$.trial')) = 'OBJECT'")
    expect(sql).toContain("`Subscriptions`.`status` is null or `Subscriptions`.`status` != ?")
    expect(sql).toContain(
      "NOT EXISTS (SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr.subscription_id = Subscriptions.subscription_id AND trial_pr.request_type = 'RENEWAL' AND ((trial_pr.status = 'COMPLETED' AND trial_pr.amount_charged > 0) OR trial_pr.status IN ('CREATING_SUBSCRIPTION', 'FINALIZING')))"
    )
    expect(parameters).toEqual(["cancelled"])
  })
})
