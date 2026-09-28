#!/usr/bin/env tsx
/**
 * Subscription Reconciliation Script
 *
 * Matches each active subscription to the correct product based on:
 *   1. User's whitelabel (Users.whitelabel_id → Whitelabels.code)
 *   2. Plan characteristics (role_v2, team_members)
 *   3. Exact price match (subscription.amount === product renewal_cost)
 *
 * The matching itself lives in `api/domain/services/product-matching.ts` so it can be tested, this
 * file is the database and the report around it. Keying on `role_v2` rather than `role` is RBAC
 * unification plan CO-I271 §9.4 / Q9: see that module's header for what it fixes and what to expect
 * on the first run.
 *
 * Then rebuilds subscription.data in the new format the new billing system expects.
 *
 * Usage:
 *   npx tsx scripts/reconcile-subscriptions.ts                  # dry-run (default)
 *   npx tsx scripts/reconcile-subscriptions.ts --commit         # apply changes
 *   npx tsx scripts/reconcile-subscriptions.ts --sub 123        # single subscription
 *   npx tsx scripts/reconcile-subscriptions.ts --verbose        # show per-subscription detail
 *   npx tsx scripts/reconcile-subscriptions.ts --resolve EXP:AGENT_EXP_PRO:4900 --resolve EXP:AGENT_EXP_ELITE:29900
 *                                                               # which product a subscription with these
 *                                                               # traits would land on (read-only, repeatable)
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Kysely, MysqlDialect, sql } from "kysely"
import { createPool } from "mysql2"
import type { DB } from "@api/lib/db"
import {
  buildNewSubscriptionData,
  buildProductIndex,
  findMatchingProduct,
  makeProductKey,
  parseProductData,
  parseSubscriptionData,
  resolveSubscriptionCharacteristics,
  type ProductRow,
  type SubscriptionRow,
} from "@api/domain/services/product-matching"
import { isRoleV2, legacyOf } from "@api/domain/services/role-v2"

type ResultStatus = "matched" | "reassigned" | "data_updated" | "skipped" | "failed"

interface ReconcileResult {
  subscription_id: number
  status: ResultStatus
  old_product_id: number | null
  new_product_id: number | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  reason: string
  amount: number
}

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const COMMIT = args.includes("--commit")
const VERBOSE = args.includes("--verbose")
const SUB_FLAG = args.indexOf("--sub")
const SINGLE_SUB_ID = SUB_FLAG !== -1 ? parseInt(args[SUB_FLAG + 1], 10) : null
// `--resolve <whitelabel>:<role_v2>:<amount>`, repeatable. Asks the matcher, against the real product
// index, where a subscription with these traits would land, without one having to exist. It is how
// P3 / AC24 is shown before any Express Offers subscriber does: two tiers, two products.
const RESOLVE_PROBES = args.flatMap((a, i) => (a === "--resolve" && args[i + 1] ? [args[i + 1]] : []))

// The console report is pasted into PRs, so every per-row list in it stops at this many rows. The
// complete result set goes to a gitignored file instead, where a thousand rows cost nothing.
const CONSOLE_ROW_CAP = 25
const OUT_DIR = join(__dirname, "out")

/** Print at most CONSOLE_ROW_CAP rows, then say how many were left out and where they are. */
function printCapped<T>(rows: T[], print: (row: T) => void, fullPath: string) {
  for (const row of rows.slice(0, CONSOLE_ROW_CAP)) print(row)
  if (rows.length > CONSOLE_ROW_CAP) {
    console.log(dim(`  ... and ${rows.length - CONSOLE_ROW_CAP} more, all of them in ${fullPath}`))
  }
}

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
}
function bold(s: string) { return `${C.bold}${s}${C.reset}` }
function dim(s: string) { return `${C.dim}${s}${C.reset}` }
function red(s: string) { return `${C.red}${s}${C.reset}` }
function green(s: string) { return `${C.green}${s}${C.reset}` }
function yellow(s: string) { return `${C.yellow}${s}${C.reset}` }
function cyan(s: string) { return `${C.cyan}${s}${C.reset}` }

// ─── DB Connection ───────────────────────────────────────────────────────────

function createDb(): Kysely<DB> {
  const required = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    console.error(red(`Missing env vars: ${missing.join(", ")}`))
    console.error(dim("Run via: dotenvx run --env-file=.env.production -- npx tsx scripts/reconcile-subscriptions.ts"))
    process.exit(1)
  }
  return new Kysely<DB>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER!,
        password: process.env.DB_PASS!,
        database: process.env.DB_NAME!,
        connectionLimit: 5,
      }),
    }),
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold("=== Subscription Reconciliation Script ===")}`)
  console.log(`Mode: ${COMMIT ? red("COMMIT (will write to database)") : green("DRY RUN (read-only)")}`)
  if (SINGLE_SUB_ID) console.log(`Filter: subscription_id = ${SINGLE_SUB_ID}`)
  console.log()

  // The host the process actually connected with, read from the env it was given, not the tunnel
  // anyone believes is open. Printed first so a pasted report says which database it describes.
  console.log(`Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT || "3306"}`)
  console.log()

  const db = createDb()

  try {
    // Through a tunnel DB_HOST is localhost and staging and production share a DB_NAME, so neither
    // says which cluster this is. The server's own hostname does, and it cannot be a belief.
    const { rows: identity } = await sql<{ server: string }>`SELECT @@hostname AS server`.execute(db)
    console.log(`Server: ${bold(identity[0]?.server ?? "(unknown)")}`)
    console.log()

    // ── Load products ──────────────────────────────────────────────────────
    const productRows = await db
      .selectFrom("Products")
      .select(["product_id", "product_name", "whitelabel_code", "price", "data"])
      .where("product_type", "=", "subscription")
      .execute()

    const products = productRows.map((r) => parseProductData(r as unknown as ProductRow))
    const productIndex = buildProductIndex(products)
    const productById = new Map(products.map((p) => [p.product_id, p]))

    console.log(`Loaded ${bold(String(products.length))} subscription products`)
    console.log(`Index keys: ${productIndex.byTier.size}`)

    // The tier each product sells, printed before anything is matched. Two products that share a
    // line here are two products reconciliation cannot tell apart, which is the defect Q9 names,
    // so this is the first thing to read in a dry run, ahead of the counts.
    const collisions = [...productIndex.byTier.entries()].filter(([, group]) => group.length > 1)
    if (collisions.length > 0) {
      console.log(dim(`${collisions.length} key(s) hold more than one product, told apart by price alone:`))
      for (const [key, group] of collisions) {
        console.log(dim(`  ${key}: ${group.map((p) => `${p.product_name} (${p.renewal_cost})`).join(", ")}`))
      }
    }
    const roleless = products.filter((p) => p.role_v2 === null)
    if (roleless.length > 0) {
      console.log(yellow(`${roleless.length} product(s) name no resolvable role: ${roleless.map((p) => p.product_name).join(", ")}`))
    }
    console.log()

    if (RESOLVE_PROBES.length > 0) {
      console.log(bold("--- Resolve probes (no subscription read or written) ---"))
      for (const probe of RESOLVE_PROBES) {
        const [wl, roleV2, amountText] = probe.split(":")
        const amount = Number(amountText)
        if (!wl || !isRoleV2(roleV2) || !Number.isFinite(amount)) {
          console.log(red(`  ${probe}: expected <whitelabel>:<role_v2>:<amount>`))
          continue
        }
        const is_team_plan = roleV2 === "TEAMOWNER"
        const { product, reason } = findMatchingProduct(
          productIndex,
          wl,
          { role: legacyOf(roleV2), role_v2: roleV2, is_team_plan, team_members: 0 },
          amount
        )
        const key = makeProductKey(wl, roleV2, is_team_plan, 0)
        console.log(
          product
            ? green(`  ${probe} -> product ${product.product_id} "${product.product_name}" (key ${key}, ${reason})`)
            : red(`  ${probe} -> no product (${reason})`)
        )
      }
      console.log()
    }

    // ── Load subscriptions with user + whitelabel join ─────────────────────
    let query = db
      .selectFrom("Subscriptions as s")
      .leftJoin("Users as u", "u.user_id", "s.user_id")
      .leftJoin("Whitelabels as w", "w.whitelabel_id", "u.whitelabel_id")
      .select([
        "s.subscription_id",
        "s.subscription_name",
        "s.user_id",
        "s.product_id",
        "s.amount",
        "s.duration",
        "s.status",
        "s.data",
        "u.role as user_role",
        // `Users.role_v2` is not in the generated `api/lib/db.d.ts`, that file was last generated
        // before the column shipped, and regenerating it here would sweep in every other schema
        // change since. Selected as a raw fragment, typed at the SubscriptionRow boundary.
        sql<string | null>`u.role_v2`.as("user_role_v2"),
        "u.is_premium as user_is_premium",
        "u.team_id as user_team_id",
        "u.whitelabel_id as user_whitelabel_id",
        "w.code as whitelabel_code",
      ])

    if (SINGLE_SUB_ID) {
      query = query.where("s.subscription_id", "=", SINGLE_SUB_ID)
    }

    const subscriptions = await query.execute()
    console.log(`Loaded ${bold(String(subscriptions.length))} subscriptions`)
    console.log()

    // ── Process each subscription ──────────────────────────────────────────
    const results: ReconcileResult[] = []
    // Subscriptions that only matched on the old, coarser key. Not a failure: it is how this
    // script has always matched them, but it is the set that cannot be told apart by tier, so it
    // is the set an Express Offers Pro or Elite could still be mispriced in. Worth reading.
    const legacyMatches: number[] = []
    const activeStatuses = new Set(["active", "suspended", "paused", "trial"])

    for (const sub of subscriptions) {
      const row = sub as unknown as SubscriptionRow
      const isActive = row.status !== null && activeStatuses.has(row.status)

      // Skip specific subscriptions that require manual reconciliation
      const MANUAL_SKIP_IDS = new Set([37, 116])
      if (MANUAL_SKIP_IDS.has(row.subscription_id)) {
        results.push({
          subscription_id: row.subscription_id,
          status: "skipped",
          old_product_id: row.product_id,
          new_product_id: null,
          old_data: null,
          new_data: null,
          reason: "manually excluded — requires manual reconciliation",
          amount: row.amount,
        })
        continue
      }

      // Skip deferred-provisioning subscriptions (user_id NULL, created by new code)
      if (row.user_id === null) {
        results.push({
          subscription_id: row.subscription_id,
          status: "skipped",
          old_product_id: row.product_id,
          new_product_id: null,
          old_data: null,
          new_data: null,
          reason: "user_id is NULL (deferred provisioning)",
          amount: row.amount,
        })
        continue
      }

      // Skip inactive subscriptions — report but don't fail on them
      if (!isActive) {
        results.push({
          subscription_id: row.subscription_id,
          status: "skipped",
          old_product_id: row.product_id,
          new_product_id: null,
          old_data: null,
          new_data: null,
          reason: `status=${row.status ?? "NULL"} (inactive — skipped)`,
          amount: row.amount,
        })
        continue
      }

      const subData = parseSubscriptionData(row.data)
      const characteristics = resolveSubscriptionCharacteristics(row, subData)

      // Resolve whitelabel code from the Whitelabels table join
      const whitelabelCode = row.whitelabel_code ?? "default"

      // Find matching product
      const { product: matched, reason, viaLegacyRole } = findMatchingProduct(
        productIndex,
        whitelabelCode,
        {
          role: characteristics.role,
          role_v2: characteristics.role_v2,
          is_team_plan: characteristics.is_team_plan,
          team_members: characteristics.team_members,
        },
        row.amount
      )
      if (viaLegacyRole) legacyMatches.push(row.subscription_id)

      if (!matched) {
        results.push({
          subscription_id: row.subscription_id,
          status: "failed",
          old_product_id: row.product_id,
          new_product_id: null,
          old_data: subData,
          new_data: null,
          reason,
          amount: row.amount,
        })
        continue
      }

      // Build new subscription data
      const newData = buildNewSubscriptionData(matched, { team_id: characteristics.team_id })

      // Determine what changed
      const productIdChanged = row.product_id !== matched.product_id
      const resultStatus: ResultStatus = productIdChanged ? "reassigned" : "data_updated"
      const resultReason = productIdChanged
        ? `product_id ${row.product_id} → ${matched.product_id} (${reason})`
        : `product_id=${matched.product_id} confirmed, data rebuilt`

      results.push({
        subscription_id: row.subscription_id,
        status: resultStatus,
        old_product_id: row.product_id,
        new_product_id: matched.product_id,
        old_data: subData,
        new_data: newData,
        reason: resultReason,
        amount: row.amount,
      })
    }

    // ── Report ─────────────────────────────────────────────────────────────
    const matched = results.filter((r) => r.status === "matched")
    const reassigned = results.filter((r) => r.status === "reassigned")
    const dataUpdated = results.filter((r) => r.status === "data_updated")
    const skipped = results.filter((r) => r.status === "skipped")
    const failed = results.filter((r) => r.status === "failed")

    console.log(bold("=== Reconciliation Report ==="))
    console.log()
    console.log(`  Scanned:        ${bold(String(results.length))}`)
    console.log(`  Data updated:   ${green(String(dataUpdated.length))} ${dim("(product_id correct, data rebuilt)")}`)
    console.log(`  Reassigned:     ${yellow(String(reassigned.length))} ${dim("(product_id changed, price verified)")}`)
    console.log(`  Skipped:        ${dim(String(skipped.length))} ${dim("(inactive / NULL user_id)")}`)
    console.log(
      `  Legacy-role:    ${legacyMatches.length > 0 ? yellow(String(legacyMatches.length)) : "0"} ` +
        dim("(matched on role alone, these subscriptions record no tier)")
    )
    if (VERBOSE && legacyMatches.length > 0) {
      const shown = legacyMatches.slice(0, CONSOLE_ROW_CAP).join(", ")
      const more = legacyMatches.length > CONSOLE_ROW_CAP ? ` ... and ${legacyMatches.length - CONSOLE_ROW_CAP} more` : ""
      console.log(dim(`    sub_ids: ${shown}${more}`))
    }
    console.log(`  ${failed.length > 0 ? red("FAILED:") : "Failed:"}        ${failed.length > 0 ? red(String(failed.length)) : "0"} ${failed.length > 0 ? red("← MANUAL REVIEW REQUIRED") : ""}`)
    console.log()

    // Every result, in full, where the console cap cannot truncate it.
    mkdirSync(OUT_DIR, { recursive: true })
    const fullPath = join(OUT_DIR, `reconcile-${process.env.DB_NAME}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
    writeFileSync(
      fullPath,
      JSON.stringify({ database: process.env.DB_NAME, host: process.env.DB_HOST, server: identity[0]?.server, commit: COMMIT, legacyMatches, results }, null, 2)
    )
    console.log(dim(`Full results: ${fullPath}`))
    console.log()

    // Verbose: show every result
    if (VERBOSE) {
      for (const r of results) {
        if (r.status === "skipped" && !SINGLE_SUB_ID) continue
        const color = r.status === "failed" ? red : r.status === "reassigned" ? yellow : dim
        console.log(color(`  [sub=${r.subscription_id}] ${r.status.toUpperCase()}: ${r.reason}`))
        if (r.status === "reassigned" || SINGLE_SUB_ID) {
          if (r.old_data) console.log(dim(`    old data: ${JSON.stringify(r.old_data)}`))
          if (r.new_data) console.log(green(`    new data: ${JSON.stringify(r.new_data)}`))
        }
      }
      console.log()
    }

    // Always show reassigned details
    if (reassigned.length > 0) {
      console.log(bold("--- Reassigned ---"))
      printCapped(reassigned, (r) => {
        console.log(yellow(
          `  sub_id=${r.subscription_id}  old_product=${r.old_product_id}  new_product=${r.new_product_id}  amount=${r.amount}`
        ))
        console.log(dim(`    ${r.reason}`))
      }, fullPath)
      console.log()
    }

    // Always show failures
    if (failed.length > 0) {
      console.log(red(bold("--- FAILED (manual review required) ---")))
      printCapped(failed, (r) => {
        console.log(red(
          `  sub_id=${r.subscription_id}  product_id=${r.old_product_id}  amount=${r.amount}`
        ))
        console.log(red(`    ${r.reason}`))
      }, fullPath)
      console.log()
    }

    // ── Commit ─────────────────────────────────────────────────────────────
    if (COMMIT) {
      if (failed.length > 0) {
        console.error(red(bold(`Aborting: ${failed.length} subscription(s) failed to match.`)))
        console.error(red("Resolve all failures before running with --commit."))
        console.error(red("No changes were written to the database."))
        await db.destroy()
        process.exit(1)
      }

      const toUpdate = results.filter((r) => r.status === "reassigned" || r.status === "data_updated")

      if (toUpdate.length === 0) {
        console.log(dim("Nothing to update."))
        await db.destroy()
        return
      }

      console.log(bold(`Applying ${toUpdate.length} update(s)...`))

      await db.transaction().execute(async (trx) => {
        for (const r of toUpdate) {
          const updateFields: Record<string, unknown> = {
            data: JSON.stringify(r.new_data),
            updatedAt: new Date(),
          }
          if (r.status === "reassigned" && r.new_product_id !== null) {
            updateFields.product_id = r.new_product_id
          }
          await trx
            .updateTable("Subscriptions")
            .set(updateFields)
            .where("subscription_id", "=", r.subscription_id)
            .execute()
        }
      })

      console.log(green(bold(`Done. ${toUpdate.length} subscription(s) updated.`)))
    } else {
      const actionable = results.filter((r) => r.status === "reassigned" || r.status === "data_updated")
      if (actionable.length > 0 && failed.length === 0) {
        console.log(dim(`Run with ${bold("--commit")} to apply ${actionable.length} update(s).`))
      } else if (failed.length > 0) {
        console.log(red(`${failed.length} failure(s) must be resolved before --commit will proceed.`))
      }
    }

    await db.destroy()
  } catch (err) {
    console.error(red(`\nFatal error: ${err instanceof Error ? err.message : String(err)}`))
    if (err instanceof Error && err.stack) console.error(dim(err.stack))
    await db.destroy()
    process.exit(1)
  }
}

main()
