/**
 * Enrollment Intent Service
 *
 * Pure rules for what `GET /manage/enrollment` is offering a user with no billing subscription,
 * decided once on the server and returned as `intent` so the account site's copy and routing read
 * one value instead of re-deriving it:
 *
 * - `buy_product`: the user is buying one named plan. A direct product link was followed, the user
 *   is an Express Offers Guest being sent to their upgrade, or an admin link chose
 *   `premium_cashoffers`.
 * - `homeuptick_only`: HomeUptick standalone (SHELL CashOffers access plus the HomeUptick fee).
 * - `activate_homeuptick`: the user pays for CashOffers elsewhere (`is_premium = 1`) and adding a
 *   card turns HomeUptick on (`external_cashoffers`).
 *
 * The old flow assumed "no subscription plus a card means activating HomeUptick" for everyone. That
 * is wrong for the Express Offers roles: a Guest (`AGENT_EXP_GUEST`) has no HomeUptick access at
 * all, and the only thing they can act on is the upgrade to Pro.
 */

import type { RoleV2 } from "./role-v2"

export type EnrollmentIntent = "buy_product" | "homeuptick_only" | "activate_homeuptick"

export const ENROLLMENT_INTENTS = ["buy_product", "homeuptick_only", "activate_homeuptick"] as const

export type EnrollmentCategory = "premium_cashoffers" | "external_cashoffers" | "homeuptick_only"

/**
 * The upgrade each role is sent to when it opens the account site with nothing else to do. The one
 * place billing states the Guest-to-Pro mapping.
 *
 * Mirror of the `upgradeTo` role setting in the mono repo's `@g8r/schemas`
 * (`packages/schemas/src/roles/`), which the api-v2 upgrade link (`signup/upgrade/upgradeDestination.ts`)
 * reads. The two repos do not share a package, so this is a copy of the one entry billing acts on.
 */
export const UPGRADE_TARGET_ROLE_V2: Partial<Record<RoleV2, RoleV2>> = {
  AGENT_EXP_GUEST: "AGENT_EXP_PRO",
}

export function upgradeTargetFor(role: RoleV2 | null | undefined): RoleV2 | null {
  if (!role) return null
  return UPGRADE_TARGET_ROLE_V2[role] ?? null
}

/**
 * Roles that must never be offered a `homeuptick_only` product, on any path. An Express Offers
 * Guest has no HomeUptick access, so a HomeUptick standalone plan is not something they can buy.
 */
const HOMEUPTICK_ONLY_BLOCKED: ReadonlySet<RoleV2> = new Set<RoleV2>(["AGENT_EXP_GUEST"])

export function mayBeOfferedHomeUptickOnly(role: RoleV2 | null | undefined): boolean {
  return !role || !HOMEUPTICK_ONLY_BLOCKED.has(role)
}

/** The intent a product category answers with when the category logic (or `?category=`) chose it. */
export function intentForCategory(category: EnrollmentCategory): EnrollmentIntent {
  switch (category) {
    case "homeuptick_only":
      return "homeuptick_only"
    case "external_cashoffers":
      return "activate_homeuptick"
    case "premium_cashoffers":
      return "buy_product"
  }
}

export interface UpgradeCandidate {
  product_id: number
  product_type: string
  whitelabel_code: string | null
  data: unknown
}

function productRoleV2(data: unknown): unknown {
  const parsed = typeof data === "string" ? safeParse(data) : data
  return (parsed as any)?.cashoffers?.user_config?.role_v2
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * The one product that is the user's upgrade, mirroring the api-v2 resolver's rule: a
 * `subscription` product whose `data.cashoffers.user_config.role_v2` is the target, whose
 * `whitelabel_code` equals the user's white label code exactly (NULL matches only NULL). Exactly
 * one match, or a miss with the reason: two candidates means the choice is not the server's to
 * make, and a miss sends the user to the account dashboard, never to HomeUptick-only.
 */
export function selectUpgradeProduct<P extends UpgradeCandidate>(
  products: readonly P[],
  target: RoleV2,
  userWhitelabelCode: string | null
): { product: P } | { reason: string } {
  const matches = products.filter(
    (p) =>
      p.product_type === "subscription" &&
      (p.whitelabel_code ?? null) === (userWhitelabelCode ?? null) &&
      productRoleV2(p.data) === target
  )
  if (matches.length === 1) return { product: matches[0] }
  return { reason: `${matches.length} products for ${target} in ${userWhitelabelCode ?? "no white label"}` }
}
