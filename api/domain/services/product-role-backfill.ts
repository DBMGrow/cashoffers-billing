/**
 * The pure core of the `role_v2` product backfill, RBAC unification plan CO-I271 §9.4, change 4.
 *
 * Separated from `api/scripts/migrate-product-role-v2.ts` for the same reason the product matcher
 * is separated from the reconcile script: the script opens a database connection and runs on
 * import, so nothing inside it can be tested, and a backfill is the last thing that should be
 * checked by running it. Plan failure F5 is a backfill assigning the wrong tier at scale.
 */

import { deriveRoleV2FromLegacy, isRoleV2, type RoleV2 } from "./role-v2"

export interface ConfigSite {
  /** Where in `Products.data` this config lives, for the report. */
  path: "user_config" | "cashoffers.user_config"
  config: Record<string, unknown>
}

/** Every `user_config` a product carries. Both shapes are live: the root one predates migration 011. */
export function configSites(data: Record<string, unknown>): ConfigSite[] {
  const sites: ConfigSite[] = []
  if (data.user_config && typeof data.user_config === "object") {
    sites.push({ path: "user_config", config: data.user_config as Record<string, unknown> })
  }
  const cashoffers = data.cashoffers as Record<string, unknown> | undefined
  if (cashoffers?.user_config && typeof cashoffers.user_config === "object") {
    sites.push({ path: "cashoffers.user_config", config: cashoffers.user_config as Record<string, unknown> })
  }
  return sites
}

export type Outcome =
  | { kind: "stamped"; changes: { path: string; from: string; premium: unknown; to: RoleV2 }[] }
  | { kind: "already"; roles: string[] }
  | { kind: "no_config" }
  | { kind: "unresolvable"; roles: string[] }

export function planProduct(data: Record<string, unknown>): Outcome {
  const sites = configSites(data)
  if (sites.length === 0) return { kind: "no_config" }

  const changes: { path: string; from: string; premium: unknown; to: RoleV2 }[] = []
  const already: string[] = []
  const unresolvable: string[] = []

  for (const site of sites) {
    if (isRoleV2(site.config.role_v2)) {
      already.push(site.config.role_v2)
      continue
    }
    const role = site.config.role as string | undefined
    const derived = deriveRoleV2FromLegacy(role, site.config.is_premium as number | undefined)
    if (!derived) {
      unresolvable.push(String(role ?? "(none)"))
      continue
    }
    changes.push({ path: site.path, from: String(role), premium: site.config.is_premium, to: derived })
  }

  if (changes.length > 0) return { kind: "stamped", changes }
  if (unresolvable.length > 0) return { kind: "unresolvable", roles: unresolvable }
  return { kind: "already", roles: already }
}

/** Apply the plan to a copy of the product's data. Mutates only the `role_v2` key of each config. */
export function applyPlan(data: Record<string, unknown>, outcome: Outcome): Record<string, unknown> {
  if (outcome.kind !== "stamped") return data
  const next = JSON.parse(JSON.stringify(data)) as Record<string, unknown>
  for (const change of outcome.changes) {
    const target =
      change.path === "user_config"
        ? (next.user_config as Record<string, unknown>)
        : ((next.cashoffers as Record<string, unknown>).user_config as Record<string, unknown>)
    target.role_v2 = change.to
  }
  return next
}
