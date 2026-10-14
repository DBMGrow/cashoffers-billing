import { describe, it, expect } from "vitest"
import {
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
} from "kysely"
import type { DB } from "@api/lib/db"
import { SubscriptionRepository } from "./subscription.repository"

/**
 * A Kysely driver that records each compiled statement and returns no rows, so the test reads the
 * exact SQL the trial invariant queries (Desk #1350) send to MySQL without a database.
 */
function capturingDb() {
  const queries: CompiledQuery[] = []
  const connection: DatabaseConnection = {
    executeQuery: async (query) => {
      queries.push(query)
      return { rows: [] }
    },
    streamQuery: () => {
      throw new Error("not supported")
    },
  }
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  }
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver,
      createIntrospector: (k) => new MysqlIntrospector(k),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
  })
  return { repo: new SubscriptionRepository(db), queries }
}

const NOW = new Date("2026-10-12T12:00:00.000Z")
const ENDS_AT = "JSON_UNQUOTE(JSON_EXTRACT(Subscriptions.data, '$.trial.ends_at'))"

describe("SubscriptionRepository trial invariants (Desk #1350)", () => {
  it("findTrialsWithoutCard: live, chargeable trials whose user has no UserCards row with a card id", async () => {
    const { repo, queries } = capturingDb()
    await repo.findTrialsWithoutCard(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain("`Subscriptions`.`status` = ?")
    expect(sql).toContain("`Subscriptions`.`user_id` is not null")
    expect(sql).toContain("`Subscriptions`.`cancel_on_renewal` is null or `Subscriptions`.`cancel_on_renewal` = ?")
    expect(sql).toContain(`${ENDS_AT} > ?`)
    expect(sql).toMatch(
      /not exists \(select `UserCards`\.`id` from `UserCards` where `UserCards`\.`user_id` = `Subscriptions`\.`user_id` and `UserCards`\.`card_id` is not null and `UserCards`\.`card_id` != \?\)/
    )
    expect(parameters).toEqual(["active", 0, NOW.toISOString(), ""])
  })

  it("findEndedTrialsUnreconciled: ended over 24h ago, still active, with no paid renewal, no cancel and no failure", async () => {
    const { repo, queries } = capturingDb()
    await repo.findEndedTrialsUnreconciled(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain(`${ENDS_AT} < ?`)
    // D6, AC29: only an active row is charged by the cron, so only an active row can be unreconciled.
    // A paused trial (status 'paused', set by user.deactivated and the pause use case), and a
    // cancelled, inactive or suspended one, are never charged.
    expect(sql).toContain("`Subscriptions`.`status` = ?")
    expect(sql).not.toContain("`Subscriptions`.`status` is null")
    expect(sql).not.toContain("`Subscriptions`.`status` !=")
    expect(sql).toContain("`Subscriptions`.`payment_failure_count` = ?")
    expect(sql).toMatch(
      /not exists \(select `PurchaseRequests`\.`request_id` from `PurchaseRequests` where `PurchaseRequests`\.`subscription_id` = `Subscriptions`\.`subscription_id` and `PurchaseRequests`\.`request_type` = \? and `PurchaseRequests`\.`status` = \? and `PurchaseRequests`\.`amount_charged` > \?\)/
    )
    // The cutoff is a day before now: the cron gets a day to take the first charge. renewal_date must
    // have passed it too (D1, AC22): the cron charges on renewal_date.
    expect(sql).toContain("`Subscriptions`.`renewal_date` < ?")
    expect(parameters).toEqual([
      "2026-10-11T12:00:00.000Z",
      new Date("2026-10-11T12:00:00.000Z"),
      "active",
      0,
      0,
      "RENEWAL",
      "COMPLETED",
      0,
    ])
  })

  it("findActiveTrials: active, user-bound subscriptions whose trial has not ended", async () => {
    const { repo, queries } = capturingDb()
    await repo.findActiveTrials(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain(`${ENDS_AT} > ?`)
    expect(parameters).toEqual(["active", NOW.toISOString()])
  })

  it("AC29: a paused trial reaches no reminder, count or anomaly query; only the drift check still reads it", async () => {
    const { repo, queries } = capturingDb()
    await repo.findTrialsEndingWithin(7, NOW)
    await repo.findActiveTrials(NOW)
    await repo.findTrialsWithoutCard(NOW)
    await repo.findEndedTrialsUnreconciled(NOW)

    // Each one keeps only `status = 'active'`: a paused trial gets no reminder, is not counted as an
    // active trial or as ending in 7 days, and is neither without-card nor unreconciled.
    for (const { sql, parameters } of queries) {
      expect(sql).toMatch(/`(Subscriptions`\.`)?status` = \?/)
      expect(parameters).toContain("active")
    }

    // The D1 drift check keeps a paused trial on purpose: its dates must still agree, because the
    // reactivation moves renewal_date and the repository moves ends_at with it.
    const drift = capturingDb()
    await drift.repo.findUnconvertedTrials()
    const [{ sql, parameters }] = drift.queries
    expect(sql).toContain("`Subscriptions`.`status` is null or `Subscriptions`.`status` != ?")
    expect(parameters).toEqual(["cancelled"])
  })

  it("only reads: no statement writes", async () => {
    const { repo, queries } = capturingDb()
    await repo.findActiveTrials(NOW)
    await repo.findTrialsWithoutCard(NOW)
    await repo.findEndedTrialsUnreconciled(NOW)
    await repo.findUnconvertedTrials()

    expect(queries).toHaveLength(4)
    for (const q of queries) expect(q.sql.startsWith("select ")).toBe(true)
  })
})
