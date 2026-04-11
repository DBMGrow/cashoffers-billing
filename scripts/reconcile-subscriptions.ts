#!/usr/bin/env tsx
/**
 * Subscription Reconciliation Script
 *
 * Matches each active subscription to the correct product based on:
 *   1. User's whitelabel (Users.whitelabel_id → Whitelabels.code)
 *   2. Plan characteristics (role, team_members)
 *   3. Exact price match (subscription.amount === product renewal_cost)
 *
 * Then rebuilds subscription.data in the new format the new billing system expects.
 *
 * Usage:
 *   npx tsx scripts/reconcile-subscriptions.ts                  # dry-run (default)
 *   npx tsx scripts/reconcile-subscriptions.ts --commit         # apply changes
 *   npx tsx scripts/reconcile-subscriptions.ts --sub 123        # single subscription
 *   npx tsx scripts/reconcile-subscriptions.ts --verbose        # show per-subscription detail
 */

import { Kysely, MysqlDialect, sql } from "kysely"
import { createPool } from "mysql2"
import type { DB } from "@api/lib/db"

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const COMMIT = args.includes("--commit")
const VERBOSE = args.includes("--verbose")
const SUB_FLAG = args.indexOf("--sub")
const SINGLE_SUB_ID = SUB_FLAG !== -1 ? parseInt(args[SUB_FLAG + 1], 10) : null

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductRow {
  product_id: number
  product_name: string
  whitelabel_code: string | null
  price: number
  data: string | null
}

interface ParsedProduct {
  product_id: number
  product_name: string
  whitelabel_code: string | null
  signup_fee: number // Products.price
  renewal_cost: number
  duration: string
  role: string
  is_team_plan: boolean
  team_members: number
  cashoffers: Record<string, unknown> | null
  raw_data: Record<string, unknown>
}

interface SubscriptionRow {
  subscription_id: number
  subscription_name: string
  user_id: number | null
  product_id: number | null
  amount: number
  duration: string
  status: string | null
  data: string | null
  // joined from Users
  user_role: string | null
  user_team_id: number | null
  user_whitelabel_id: number | null
  // joined from Whitelabels
  whitelabel_code: string | null
}

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

// ─── Product Index ───────────────────────────────────────────────────────────

/**
 * Build a lookup index from products. Key structure:
 *   whitelabel_code -> role -> team_members -> renewal_cost -> product
 *
 * This allows matching by all four dimensions. Products with null whitelabel_code
 * (free tiers, one-time) are indexed under the key "__null__".
 */
function buildProductIndex(products: ParsedProduct[]): Map<string, ParsedProduct[]> {
  const index = new Map<string, ParsedProduct[]>()
  for (const p of products) {
    const key = makeProductKey(p.whitelabel_code, p.role, p.is_team_plan, p.team_members)
    const existing = index.get(key) || []
    existing.push(p)
    index.set(key, existing)
  }
  return index
}

function makeProductKey(
  whitelabelCode: string | null,
  role: string,
  isTeamPlan: boolean,
  teamMembers: number
): string {
  const wl = whitelabelCode ?? "__null__"
  const tm = isTeamPlan ? String(teamMembers) : "0"
  return `${wl}|${role}|${tm}`
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseProductData(row: ProductRow): ParsedProduct {
  const raw: Record<string, unknown> = row.data
    ? typeof row.data === "string" ? JSON.parse(row.data) : row.data
    : {}

  // Post-migration-011 format: cashoffers.user_config at nested level
  // Pre-migration-011 format: user_config at root
  const cashoffers = raw.cashoffers as Record<string, unknown> | undefined
  const userConfig = (cashoffers?.user_config ?? raw.user_config ?? {}) as Record<string, unknown>

  return {
    product_id: row.product_id,
    product_name: row.product_name,
    whitelabel_code: row.whitelabel_code,
    signup_fee: row.price,
    renewal_cost: (raw.renewal_cost as number) ?? 0,
    duration: (raw.duration as string) ?? "monthly",
    role: (userConfig.role as string) ?? "AGENT",
    is_team_plan: (userConfig.is_team_plan as boolean) ?? (raw.team as boolean) ?? false,
    team_members: (userConfig.team_members as number) ?? (raw.team_members as number) ?? 0,
    cashoffers: cashoffers ? { ...cashoffers } : null,
    raw_data: raw,
  }
}

function parseSubscriptionData(data: string | null): Record<string, unknown> {
  if (!data) return {}
  try {
    return typeof data === "string" ? JSON.parse(data) : data
  } catch {
    return {}
  }
}

// ─── Matching ────────────────────────────────────────────────────────────────

function resolveSubscriptionCharacteristics(
  sub: SubscriptionRow,
  subData: Record<string, unknown>
): { role: string; is_team_plan: boolean; team_members: number; team_id: number | null } {
  // Extract from subscription.data (old format)
  const dataUserConfig = subData.user_config as Record<string, unknown> | undefined
  const dataCashoffers = subData.cashoffers as Record<string, unknown> | undefined
  const cashoffersUserConfig = dataCashoffers?.user_config as Record<string, unknown> | undefined

  // Role: subscription.data.user_config.role → cashoffers.user_config.role → Users.role
  const role =
    (dataUserConfig?.role as string) ??
    (cashoffersUserConfig?.role as string) ??
    sub.user_role ??
    "AGENT"

  // Team plan detection — only TEAMOWNER role is a team plan
  const is_team_plan = role === "TEAMOWNER"

  // Team members — only relevant for TEAMOWNER
  const team_members = is_team_plan
    ? ((dataUserConfig?.team_members as number) ??
       (cashoffersUserConfig?.team_members as number) ??
       (subData.team_members as number) ??
       0)
    : 0

  // Team ID: preserve from old subscription data or user
  const team_id =
    (subData.team_id as number | null) ??
    sub.user_team_id ??
    null

  return { role, is_team_plan, team_members, team_id }
}

function findMatchingProduct(
  index: Map<string, ParsedProduct[]>,
  whitelabelCode: string | null,
  characteristics: { role: string; is_team_plan: boolean; team_members: number },
  amount: number
): { product: ParsedProduct | null; reason: string } {
  const key = makeProductKey(
    whitelabelCode,
    characteristics.role,
    characteristics.is_team_plan,
    characteristics.team_members
  )
  const candidates = index.get(key)

  if (!candidates || candidates.length === 0) {
    // Try null-whitelabel products (free tiers) as fallback
    if (whitelabelCode !== null) {
      const nullKey = makeProductKey(null, characteristics.role, characteristics.is_team_plan, characteristics.team_members)
      const nullCandidates = index.get(nullKey)
      if (nullCandidates) {
        const priceMatch = nullCandidates.find((p) => p.renewal_cost === amount)
        if (priceMatch) return { product: priceMatch, reason: "matched via null-whitelabel fallback" }
      }
    }
    return {
      product: null,
      reason: `no product found for whitelabel=${whitelabelCode} role=${characteristics.role} ` +
        `team_members=${characteristics.team_members} amount=${amount}`,
    }
  }

  // Exact price match required
  const priceMatch = candidates.find((p) => p.renewal_cost === amount)
  if (!priceMatch) {
    const availablePrices = candidates.map((p) => p.renewal_cost).join(", ")
    return {
      product: null,
      reason: `PRICE MISMATCH: whitelabel=${whitelabelCode} role=${characteristics.role} ` +
        `team_members=${characteristics.team_members} subscription.amount=${amount} ` +
        `but available product renewal_costs=[${availablePrices}]`,
    }
  }

  return { product: priceMatch, reason: "exact match" }
}

// ─── Data Rebuild ────────────────────────────────────────────────────────────

function buildNewSubscriptionData(
  matchedProduct: ParsedProduct,
  oldData: Record<string, unknown>,
  sub: SubscriptionRow,
  characteristics: { team_id: number | null }
): Record<string, unknown> {
  const newData: Record<string, unknown> = {}

  // Backwards-compat fields (old code reads these)
  newData.renewal_cost = matchedProduct.renewal_cost
  newData.duration = matchedProduct.duration

  // user_config at root (old code reads subscription.data.user_config)
  const userConfig: Record<string, unknown> = {
    role: matchedProduct.role,
    is_premium: matchedProduct.raw_data.user_config
      ? (matchedProduct.raw_data.user_config as Record<string, unknown>).is_premium
      : matchedProduct.cashoffers
        ? ((matchedProduct.cashoffers.user_config as Record<string, unknown>)?.is_premium ?? 1)
        : 1,
    is_team_plan: matchedProduct.is_team_plan,
  }
  if (matchedProduct.is_team_plan) {
    userConfig.team_members = matchedProduct.team_members
  }
  newData.user_config = userConfig

  // cashoffers section (new code reads subscription.data.cashoffers)
  if (matchedProduct.cashoffers) {
    newData.cashoffers = { ...matchedProduct.cashoffers }
  }

  // Preserve team_id from old data / user
  if (characteristics.team_id) {
    newData.team_id = characteristics.team_id
  }

  return newData
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold("=== Subscription Reconciliation Script ===")}`)
  console.log(`Mode: ${COMMIT ? red("COMMIT (will write to database)") : green("DRY RUN (read-only)")}`)
  if (SINGLE_SUB_ID) console.log(`Filter: subscription_id = ${SINGLE_SUB_ID}`)
  console.log()

  const db = createDb()

  try {
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
    console.log(`Index keys: ${productIndex.size}`)
    console.log()

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
      const { product: matched, reason } = findMatchingProduct(
        productIndex,
        whitelabelCode,
        { role: characteristics.role, is_team_plan: characteristics.is_team_plan, team_members: characteristics.team_members },
        row.amount
      )

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
      const newData = buildNewSubscriptionData(matched, subData, row, { team_id: characteristics.team_id })

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
    console.log(`  ${failed.length > 0 ? red("FAILED:") : "Failed:"}        ${failed.length > 0 ? red(String(failed.length)) : "0"} ${failed.length > 0 ? red("← MANUAL REVIEW REQUIRED") : ""}`)
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
      for (const r of reassigned) {
        console.log(yellow(
          `  sub_id=${r.subscription_id}  old_product=${r.old_product_id}  new_product=${r.new_product_id}  amount=${r.amount}`
        ))
        console.log(dim(`    ${r.reason}`))
      }
      console.log()
    }

    // Always show failures
    if (failed.length > 0) {
      console.log(red(bold("--- FAILED (manual review required) ---")))
      for (const r of failed) {
        console.log(red(
          `  sub_id=${r.subscription_id}  product_id=${r.old_product_id}  amount=${r.amount}`
        ))
        console.log(red(`    ${r.reason}`))
      }
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
