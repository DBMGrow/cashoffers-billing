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

/** The conversion guard both trial rules share, matched in full. */
const NOT_CONVERTED =
  /NOT EXISTS \(SELECT 1 FROM PurchaseRequests AS trial_pr WHERE trial_pr\.subscription_id = Subscriptions\.subscription_id AND trial_pr\.request_type = 'RENEWAL' AND \(\(trial_pr\.status = 'COMPLETED' AND trial_pr\.amount_charged > 0\) OR trial_pr\.status IN \('CREATING_SUBSCRIPTION', 'FINALIZING'\)\)\)/
    .source

const CARRIED =
  /CASE WHEN JSON_TYPE\(JSON_EXTRACT\(Subscriptions\.data, '\$\.trial'\)\) = 'OBJECT' AND /.source +
  NOT_CONVERTED +
  / AND JSON_EXTRACT\(\?, '\$\.trial'\) IS NULL THEN JSON_SET\(\?, '\$\.trial', JSON_EXTRACT\(Subscriptions\.data, '\$\.trial'\)\) ELSE \? END/
    .source

/**
 * The D5 rewrite of a written `data` document (Desk #1350): CASE WHEN the stored row carries a
 * trial object, has not converted, and the new document has no `trial` THEN JSON_SET the stored
 * trial into the new document ELSE the new document as sent. The document binds to all three `?`.
 * The conversion guard is matched in full.
 */
export const TRIAL_CARRIED_OVER = new RegExp(CARRIED)

/**
 * The D6 reminder reset inside the D1 rewrite (Desk #1350): a stored `ends_at` within the drift
 * tolerance of the new date (the two `?`) merge-patches nothing, any other removes
 * `data.trial.reminder_sent_at`. Matched in full.
 */
const REMINDER_RESET =
  /IF\(JSON_UNQUOTE\(JSON_EXTRACT\(Subscriptions\.data, '\$\.trial\.ends_at'\)\) BETWEEN \? AND \?, '\{\}', '\{"trial":\{"reminder_sent_at":null\}\}'\)/
    .source

/** The document D1 rewrites: the stored `data`, the written one, or the D5 rewrite of the written one. */
const DOC = "(`Subscriptions`\\.`data`|\\?|" + CARRIED + ")"

/**
 * The D1 rewrite of `data` that `SubscriptionRepository.update` adds when a statement writes
 * `renewal_date` (Desk #1350): `data` = CASE WHEN the row carries a trial object and has not
 * converted THEN JSON_SET(ends_at), with the reminder stamp merge-patched away when the stored end
 * moved (D6), ELSE unchanged. The conversion guard is matched in full, so a test fails if it ever
 * stops excluding a converted or converting trial.
 */
export const TRIAL_END_FOLLOWS_RENEWAL = new RegExp(
  "`data` = CASE WHEN JSON_TYPE\\(JSON_EXTRACT\\(" +
    DOC +
    ", '\\$\\.trial'\\)\\) = 'OBJECT' AND " +
    NOT_CONVERTED +
    " THEN JSON_MERGE_PATCH\\(JSON_SET\\(" +
    DOC +
    ", '\\$\\.trial\\.ends_at', \\?\\), " +
    REMINDER_RESET +
    "\\) ELSE " +
    DOC +
    " END"
)

/**
 * The window `[from, to]` (ISO) inside which a captured D1 rewrite keeps `data.trial.reminder_sent_at`
 * (D6): a stored `ends_at` in it means the date did not move. Null when the statement has no rewrite.
 */
export function reminderKeptWithin(query: CompiledQuery): [string, string] | null {
  if (!TRIAL_END_FOLLOWS_RENEWAL.test(query.sql)) return null
  const at = query.sql.indexOf("'$.trial.ends_at')) BETWEEN ? AND ?")
  const index = (query.sql.slice(0, at).match(/\?/g) ?? []).length
  return [query.parameters[index] as string, query.parameters[index + 1] as string]
}

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
