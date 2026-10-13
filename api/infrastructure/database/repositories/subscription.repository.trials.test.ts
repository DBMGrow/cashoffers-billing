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

  it("findEndedTrialsUnreconciled: ended over 24h ago with no paid renewal, no cancel and no failure", async () => {
    const { repo, queries } = capturingDb()
    await repo.findEndedTrialsUnreconciled(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain(`${ENDS_AT} < ?`)
    expect(sql).toContain("`Subscriptions`.`status` is null or `Subscriptions`.`status` != ?")
    expect(sql).toContain("`Subscriptions`.`payment_failure_count` = ?")
    expect(sql).toMatch(
      /not exists \(select `PurchaseRequests`\.`request_id` from `PurchaseRequests` where `PurchaseRequests`\.`subscription_id` = `Subscriptions`\.`subscription_id` and `PurchaseRequests`\.`request_type` = \? and `PurchaseRequests`\.`status` = \? and `PurchaseRequests`\.`amount_charged` > \?\)/
    )
    // The cutoff is a day before now: the cron gets a day to take the first charge.
    expect(parameters).toEqual(["2026-10-11T12:00:00.000Z", "cancelled", 0, 0, "RENEWAL", "COMPLETED", 0])
  })

  it("findActiveTrials: active, user-bound subscriptions whose trial has not ended", async () => {
    const { repo, queries } = capturingDb()
    await repo.findActiveTrials(NOW)

    const [{ sql, parameters }] = queries
    expect(sql).toContain(`${ENDS_AT} > ?`)
    expect(parameters).toEqual(["active", NOW.toISOString()])
  })

  it("only reads: no statement writes", async () => {
    const { repo, queries } = capturingDb()
    await repo.findActiveTrials(NOW)
    await repo.findTrialsWithoutCard(NOW)
    await repo.findEndedTrialsUnreconciled(NOW)

    expect(queries).toHaveLength(3)
    for (const q of queries) expect(q.sql.startsWith("select ")).toBe(true)
  })
})
