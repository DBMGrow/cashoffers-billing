#!/usr/bin/env tsx
/**
 * Backfill: stamp `role_v2` onto every product's `user_config`.
 *
 * RBAC unification plan CO-I271 §9.4, change 4. A sibling of `migrate-product-user-config.ts`,
 * which added `user_config` to products that had none; this one adds the role column to the configs
 * that exist. It is additive in both directions: `role` and `is_premium` are left exactly as they
 * are, so a rollback is dropping one key, and billing keeps reading the legacy pair as a fallback
 * until Phase 9 U91 removes it.
 *
 * **What it cannot do, by construction.** The derivation is `(role, is_premium) -> role_v2`, and
 * that mapping has no eXp tier in its range: `(AGENT, 1)` is ambiguous between `AGENT_PREMIUM` and
 * `AGENT_EXP_ELITE`, which is the ambiguity Q9 names, so it answers with the platform-wide tier
 * every existing product actually sells. No product becomes an Express Offers tier by backfill.
 * They are named by hand, on purpose, one product at a time, once Phase 7.4 settles eXp pricing.
 *
 * Usage:
 *   npx tsx api/scripts/migrate-product-role-v2.ts                                  # dry run
 *   npx tsx api/scripts/migrate-product-role-v2.ts --commit --confirm-database=NAME # apply
 *   npx tsx api/scripts/migrate-product-role-v2.ts --verbose                        # per-product detail
 *
 * Dry run is the default and prints the full distribution before anything is written, per the
 * plan's Appendix D.6 backfill protocol: the distribution before and after is the evidence that the
 * backfill assigned what was expected, and it is worth more than the row count.
 */

import { db } from "@api/lib/database"
import { applyPlan, planProduct, type Outcome } from "@api/domain/services/product-role-backfill"

const args = process.argv.slice(2)
const COMMIT = args.includes("--commit")
const VERBOSE = args.includes("--verbose")
const CONFIRMED_DATABASE = args.find((a) => a.startsWith("--confirm-database="))?.split("=")[1]

async function main() {
  console.log(`\n=== Product role_v2 backfill ===`)
  console.log(`Mode: ${COMMIT ? "COMMIT (will write)" : "DRY RUN (read-only)"}`)
  console.log(`Database: ${process.env.DB_NAME ?? "(unset)"} on ${process.env.DB_HOST ?? "(unset)"}`)

  if (COMMIT && CONFIRMED_DATABASE !== process.env.DB_NAME) {
    // A backfill run against the wrong database is not recoverable by re-running it, and the env
    // file that is loaded is decided outside this process by dotenvx. Naming the database on the
    // command line is the one check that cannot be satisfied by habit.
    console.error(
      `\nRefusing to commit: pass --confirm-database=${process.env.DB_NAME ?? "<DB_NAME>"} to confirm the target database.`
    )
    process.exit(1)
  }

  const products = await db.selectFrom("Products").select(["product_id", "product_name", "data"]).execute()
  console.log(`\nLoaded ${products.length} products\n`)

  const planned: { product_id: number; product_name: string; outcome: Outcome; data: Record<string, unknown> }[] = []

  for (const product of products) {
    const data: Record<string, unknown> =
      typeof product.data === "string" ? JSON.parse(product.data || "{}") : ((product.data as object) ?? {})
    planned.push({
      product_id: product.product_id,
      product_name: product.product_name,
      outcome: planProduct(data),
      data,
    })
  }

  // ── Distribution, before anything is written ────────────────────────────────
  const distribution = new Map<string, number>()
  for (const p of planned) {
    if (p.outcome.kind === "stamped") {
      for (const change of p.outcome.changes) {
        const label = `${change.from} + is_premium ${change.premium ?? 0} -> ${change.to}`
        distribution.set(label, (distribution.get(label) ?? 0) + 1)
      }
    }
  }

  console.log("Distribution of what would be stamped:")
  if (distribution.size === 0) {
    console.log("  (nothing to stamp)")
  } else {
    for (const [label, count] of [...distribution.entries()].sort()) {
      console.log(`  ${String(count).padStart(4)}  ${label}`)
    }
  }

  const stamped = planned.filter((p) => p.outcome.kind === "stamped")
  const already = planned.filter((p) => p.outcome.kind === "already")
  const noConfig = planned.filter((p) => p.outcome.kind === "no_config")
  const unresolvable = planned.filter((p) => p.outcome.kind === "unresolvable")

  console.log(`\n  To stamp:        ${stamped.length}`)
  console.log(`  Already tagged:  ${already.length}`)
  console.log(`  No user_config:  ${noConfig.length}`)
  console.log(`  Unresolvable:    ${unresolvable.length}${unresolvable.length > 0 ? "  <- review these" : ""}`)

  for (const p of unresolvable) {
    const roles = p.outcome.kind === "unresolvable" ? p.outcome.roles.join(", ") : ""
    console.log(`    product ${p.product_id} "${p.product_name}" names role(s): ${roles}`)
  }

  if (VERBOSE) {
    console.log("\nPer product:")
    for (const p of stamped) {
      const changes = p.outcome.kind === "stamped" ? p.outcome.changes : []
      for (const c of changes) {
        console.log(`  ${p.product_id} "${p.product_name}" ${c.path}: ${c.from} -> ${c.to}`)
      }
    }
  }

  if (!COMMIT) {
    console.log(`\nDry run. Re-run with --commit --confirm-database=${process.env.DB_NAME ?? "<DB_NAME>"} to apply.`)
    await db.destroy()
    return
  }

  console.log(`\nApplying ${stamped.length} update(s)...`)
  await db.transaction().execute(async (trx) => {
    for (const p of stamped) {
      await trx
        .updateTable("Products")
        .set({ data: JSON.stringify(applyPlan(p.data, p.outcome)) })
        .where("product_id", "=", p.product_id)
        .execute()
    }
  })

  console.log(`Done. ${stamped.length} product(s) updated.`)
  await db.destroy()
}

main().catch(async (error) => {
  console.error("Backfill failed:", error)
  await db.destroy().catch(() => {})
  process.exit(1)
})
