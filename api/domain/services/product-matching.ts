/**
 * Product matching, the pure core of `scripts/reconcile-subscriptions.ts`.
 *
 * Reconciliation decides which product each live subscription is really on, by white label, plan
 * shape and exact price. It used to live entirely inside the script, which calls `main()` at import
 * and talks to the database, so none of it could be tested. It is here, untouched except for the
 * change below, because AC24 asks for a test and a test needs something importable.
 *
 * **The change: the product key is keyed on `role_v2`** (RBAC unification plan CO-I271 §9.4, Q9).
 * The key was `whitelabel_code | role | team_members`, and on that key an Express Offers Pro product
 * and an Elite product are the same key, `EXP|AGENT|0`, because both configs are `AGENT` with
 * `is_premium 1`. Two products $250 a month apart landed in one bucket and were told apart only by
 * an exact price match, so a price edit on either one silently reconciled subscribers onto the
 * other. `role_v2` names the tier, so they are two buckets and the price check is a check rather
 * than the whole of the answer.
 *
 * One consequence to expect on the first run, and it is why the script is dry-run by default: the
 * new key is **finer** than the old one, not a renaming of it. A free agent product and a premium
 * agent product used to share `<wl>|AGENT|0` and now have `AGENT_FREE` and `AGENT_PREMIUM` keys of
 * their own. Anything that used to match across that line only because the prices happened to agree
 * will now report as unmatched rather than matching the wrong product.
 */

import {
  bitsOf,
  deriveRoleV2FromLegacy,
  isRoleV2,
  legacyOf,
  resolveUserConfigRoleV2,
  type RoleV1,
  type RoleV2,
} from "./role-v2"

export interface ProductRow {
  product_id: number
  product_name: string
  whitelabel_code: string | null
  price: number
  data: string | null
}

export interface ParsedProduct {
  product_id: number
  product_name: string
  whitelabel_code: string | null
  signup_fee: number // Products.price
  renewal_cost: number
  duration: string
  /** The legacy role the config names, kept for the report and for products not yet backfilled. */
  role: string
  /** The role the product actually sells. `null` only when the config names nothing resolvable. */
  role_v2: RoleV2 | null
  is_team_plan: boolean
  team_members: number
  cashoffers: Record<string, unknown> | null
  raw_data: Record<string, unknown>
}

export interface SubscriptionRow {
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
  user_role_v2: string | null
  user_is_premium: number | null
  user_team_id: number | null
  user_whitelabel_id: number | null
  // joined from Whitelabels
  whitelabel_code: string | null
}

export interface SubscriptionCharacteristics {
  role: string
  role_v2: RoleV2 | null
  is_team_plan: boolean
  team_members: number
  team_id: number | null
}

export interface ProductIndex {
  /** whitelabel_code -> role_v2 -> team_members. The key this change is about. */
  byTier: Map<string, ParsedProduct[]>
  /** The same products under the old, coarser key. Used only as a fallback, see below. */
  byLegacyRole: Map<string, ParsedProduct[]>
}

/**
 * Build both indexes. Products with null whitelabel_code (free tiers, one-time) are indexed under
 * the key "__null__".
 *
 * **Why the old index is still built.** On staging, 38 live subscriptions have a user whose tier is
 * not the tier their subscription pays for: an agent who lapsed to `AGENT_FREE` while a $250 row is
 * still open, for instance. Those rows name no tier anywhere, not in their data, not on their user
 *, so keying them on the user's current tier asks a question the data cannot answer, and they went
 * from matching to failing.
 *
 * Falling back to the legacy bucket makes the new key **strictly additive**: where both sides name a
 * tier it is used, and where the subscription cannot name one the match is exactly the one the old
 * script made. It cannot reintroduce the Pro/Elite collision, because a subscription that names
 * either tier matches on the tier index and never reaches the fallback.
 *
 * **What the fallback may not reach: a product whose tier the legacy pair cannot say.** An eXp Elite
 * product is `AGENT` on the legacy key, so without this a subscription that records no tier, at
 * $299 on the EXP white label, fell through to it, took its `user_config` on rebuild, and was
 * promoted to `AGENT_EXP_ELITE` at the next renewal. Found by a `--resolve EXP:AGENT_PREMIUM:29900`
 * probe on staging. A subscription that names no tier cannot justify a tier that only exists by
 * being named, so it reports as unmatched and goes to manual review instead.
 */
export function buildProductIndex(products: ParsedProduct[]): ProductIndex {
  const byTier = new Map<string, ParsedProduct[]>()
  const byLegacyRole = new Map<string, ParsedProduct[]>()
  for (const p of products) {
    const tierKey = makeProductKey(p.whitelabel_code, p.role_v2, p.is_team_plan, p.team_members)
    byTier.set(tierKey, [...(byTier.get(tierKey) ?? []), p])

    if (p.role_v2 && deriveRoleV2FromLegacy(legacyOf(p.role_v2), bitsOf(p.role_v2)?.is_premium) !== p.role_v2) continue

    const legacyKey = makeProductKey(
      p.whitelabel_code,
      p.role_v2 ? legacyOf(p.role_v2) : null,
      p.is_team_plan,
      p.team_members
    )
    byLegacyRole.set(legacyKey, [...(byLegacyRole.get(legacyKey) ?? []), p])
  }
  return { byTier, byLegacyRole }
}

/**
 * A product whose config names no resolvable role keys on `__norole__` rather than on the empty
 * string, so it groups with nothing and reports as unmatched instead of colliding with every other
 * roleless product in the same white label.
 */
export function makeProductKey(
  whitelabelCode: string | null,
  role: RoleV2 | RoleV1 | null,
  isTeamPlan: boolean,
  teamMembers: number
): string {
  const wl = whitelabelCode ?? "__null__"
  const tm = isTeamPlan ? String(teamMembers) : "0"
  return `${wl}|${role ?? "__norole__"}|${tm}`
}

export function parseProductData(row: ProductRow): ParsedProduct {
  const raw: Record<string, unknown> = row.data ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : {}

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
    // A config with neither key defaulted its role to AGENT above, so the derivation is given that
    // same default rather than nothing, an untagged product keeps reconciling as it always has.
    role_v2: resolveUserConfigRoleV2({
      role_v2: userConfig.role_v2 as string | undefined,
      role: (userConfig.role as string) ?? "AGENT",
      is_premium: userConfig.is_premium as number | undefined,
    }),
    is_team_plan: (userConfig.is_team_plan as boolean) ?? (raw.team as boolean) ?? false,
    team_members: (userConfig.team_members as number) ?? (raw.team_members as number) ?? 0,
    cashoffers: cashoffers ? { ...cashoffers } : null,
    raw_data: raw,
  }
}

export function parseSubscriptionData(data: string | null): Record<string, unknown> {
  if (!data) return {}
  try {
    return typeof data === "string" ? JSON.parse(data) : data
  } catch {
    return {}
  }
}

export function resolveSubscriptionCharacteristics(
  sub: SubscriptionRow,
  subData: Record<string, unknown>
): SubscriptionCharacteristics {
  // Extract from subscription.data (old format)
  const dataUserConfig = subData.user_config as Record<string, unknown> | undefined
  const dataCashoffers = subData.cashoffers as Record<string, unknown> | undefined
  const cashoffersUserConfig = dataCashoffers?.user_config as Record<string, unknown> | undefined

  // Role: subscription.data.user_config.role → cashoffers.user_config.role → Users.role
  const role = (dataUserConfig?.role as string) ?? (cashoffersUserConfig?.role as string) ?? sub.user_role ?? "AGENT"

  // The same ladder on the new column, and the order is the point.
  //
  // The subscription's own config outranks the user's `role_v2`, because they answer different
  // questions: the config says what was bought, the column says what the user is right now. On
  // staging those disagree for 38 live rows, an agent who lapsed to `AGENT_FREE` with a $250 row
  // still open, a subscription whose holder has since become a WLADMIN. Asking the user first
  // reconciles a plan against a person, which is how a $250 subscription ends up keyed as free.
  //
  // The user's column is consulted after, not instead: it is the only place a tier is recorded for
  // a subscription whose data predates `user_config`, and after Phase 4 it is accurate for them.
  const configRoleV2 =
    (isRoleV2(dataUserConfig?.role_v2) ? (dataUserConfig?.role_v2 as RoleV2) : null) ??
    (isRoleV2(cashoffersUserConfig?.role_v2) ? (cashoffersUserConfig?.role_v2 as RoleV2) : null) ??
    deriveRoleV2FromLegacy(dataUserConfig?.role as string, dataUserConfig?.is_premium as number) ??
    deriveRoleV2FromLegacy(cashoffersUserConfig?.role as string, cashoffersUserConfig?.is_premium as number)

  const role_v2 =
    configRoleV2 ??
    (isRoleV2(sub.user_role_v2) ? (sub.user_role_v2 as RoleV2) : null) ??
    deriveRoleV2FromLegacy(sub.user_role, sub.user_is_premium)

  // Team plan detection, only TEAMOWNER role is a team plan
  const is_team_plan = role_v2 === "TEAMOWNER"

  // Team members, only relevant for TEAMOWNER
  const team_members = is_team_plan
    ? ((dataUserConfig?.team_members as number) ??
      (cashoffersUserConfig?.team_members as number) ??
      (subData.team_members as number) ??
      0)
    : 0

  // Team ID: preserve from old subscription data or user
  const team_id = (subData.team_id as number | null) ?? sub.user_team_id ?? null

  return { role, role_v2, is_team_plan, team_members, team_id }
}

export interface MatchResult {
  product: ParsedProduct | null
  reason: string
  /** True when the tier index found nothing and the legacy bucket answered instead. */
  viaLegacyRole: boolean
}

export function findMatchingProduct(
  index: ProductIndex,
  whitelabelCode: string | null,
  characteristics: { role: string; role_v2: RoleV2 | null; is_team_plan: boolean; team_members: number },
  amount: number
): MatchResult {
  const { role_v2, is_team_plan, team_members } = characteristics
  const legacyRole = role_v2 ? legacyOf(role_v2) : ((characteristics.role || null) as RoleV1 | null)

  const lookup = (map: Map<string, ParsedProduct[]>, wl: string | null, role: RoleV2 | RoleV1 | null) =>
    map.get(makeProductKey(wl, role, is_team_plan, team_members))?.find((p) => p.renewal_cost === amount) ?? null

  const exact = lookup(index.byTier, whitelabelCode, role_v2)
  if (exact) return { product: exact, reason: "exact match", viaLegacyRole: false }

  // Free tiers and one-time products carry no white label; they are the fallback for everyone.
  if (whitelabelCode !== null) {
    const nullWhitelabel = lookup(index.byTier, null, role_v2)
    if (nullWhitelabel) {
      return { product: nullWhitelabel, reason: "matched via null-whitelabel fallback", viaLegacyRole: false }
    }
  }

  // Nothing at the tier this subscription resolves to. Ask the question the old script asked.
  const legacy = lookup(index.byLegacyRole, whitelabelCode, legacyRole)
  const legacyNullWhitelabel = legacy ?? (whitelabelCode !== null ? lookup(index.byLegacyRole, null, legacyRole) : null)
  if (legacyNullWhitelabel) {
    return {
      product: legacyNullWhitelabel,
      reason:
        `matched on legacy role ${legacyRole}: nothing is priced at ${amount} for ` +
        `${role_v2 ?? "no tier"}, so the tier this subscription pays for is not recorded anywhere`,
      viaLegacyRole: true,
    }
  }

  const candidates = index.byTier.get(makeProductKey(whitelabelCode, role_v2, is_team_plan, team_members))
  if (candidates && candidates.length > 0) {
    const availablePrices = candidates.map((p) => p.renewal_cost).join(", ")
    return {
      product: null,
      reason:
        `PRICE MISMATCH: whitelabel=${whitelabelCode} role_v2=${role_v2 ?? "none"} ` +
        `team_members=${team_members} subscription.amount=${amount} ` +
        `but available product renewal_costs=[${availablePrices}]`,
      viaLegacyRole: false,
    }
  }

  return {
    product: null,
    reason:
      `no product found for whitelabel=${whitelabelCode} role_v2=${role_v2 ?? "none"} ` +
      `(legacy role ${legacyRole ?? "none"}) team_members=${team_members} amount=${amount}`,
    viaLegacyRole: false,
  }
}

export function buildNewSubscriptionData(
  matchedProduct: ParsedProduct,
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
  // The rebuilt subscription carries the tier the product sells, so the next reconcile reads it
  // rather than deriving it again. The legacy pair stays beside it until Phase 9 U91.
  if (matchedProduct.role_v2) userConfig.role_v2 = matchedProduct.role_v2
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
