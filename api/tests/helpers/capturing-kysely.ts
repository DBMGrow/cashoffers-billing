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

/**
 * A Kysely instance on the MySQL dialect whose driver records every compiled statement instead of
 * sending it. Selects answer with `rowsFor(query)`; writes report one affected row. Lets a test run
 * real repositories and read the exact SQL they would send, without a database.
 */
export function capturingKysely(rowsFor: (query: CompiledQuery) => unknown[] = () => []) {
  const queries: CompiledQuery[] = []
  const connection: DatabaseConnection = {
    executeQuery: async (query) => {
      queries.push(query)
      if (query.sql.startsWith("select")) return { rows: rowsFor(query) as any[] }
      return { rows: [], numAffectedRows: BigInt(1), insertId: BigInt(1) }
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
  return { db, queries }
}

/** The `update Subscriptions` statements among the captured queries, in order. */
export function subscriptionUpdates(queries: CompiledQuery[]): CompiledQuery[] {
  return queries.filter((q) => q.sql.startsWith("update `Subscriptions`"))
}

/**
 * The D1 rewrite of `data` that `SubscriptionRepository.update` adds when a statement writes
 * `renewal_date` (Desk #1350): `data` = CASE WHEN the row carries a trial object and has not
 * converted THEN JSON_SET(ends_at) ELSE unchanged. The conversion guard is matched in full, so a
 * test fails if it ever stops excluding a converted or converting trial.
 */
export const TRIAL_END_FOLLOWS_RENEWAL =
  /`data` = CASE WHEN JSON_TYPE\(JSON_EXTRACT\((`Subscriptions`\.`data`|\?), '\$\.trial'\)\) = 'OBJECT' AND NOT EXISTS \(SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr\.subscription_id = Subscriptions\.subscription_id AND trial_pr\.request_type = 'RENEWAL' AND \(\(trial_pr\.status = 'COMPLETED' AND trial_pr\.amount_charged > 0\) OR trial_pr\.status IN \('CREATING_SUBSCRIPTION', 'FINALIZING'\)\)\) THEN JSON_SET\((`Subscriptions`\.`data`|\?), '\$\.trial\.ends_at', \?\) ELSE (`Subscriptions`\.`data`|\?) END/

/**
 * The ISO `ends_at` a captured update would write through the D1 rewrite, or null when the
 * statement does not carry it. The value is the parameter bound to JSON_SET's third argument.
 */
export function trialEndsAtWritten(query: CompiledQuery): string | null {
  const match = TRIAL_END_FOLLOWS_RENEWAL.exec(query.sql)
  if (!match) return null
  // Parameters bind left to right: count the `?` before the JSON_SET value placeholder.
  const jsonSetAt = query.sql.indexOf("'$.trial.ends_at', ?")
  const before = query.sql.slice(0, jsonSetAt + "'$.trial.ends_at', ".length)
  const index = (before.match(/\?/g) ?? []).length
  return query.parameters[index] as string
}
