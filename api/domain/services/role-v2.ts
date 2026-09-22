/**
 * `role_v2`, the CashOffers role vocabulary, mirrored for billing.
 *
 * RBAC unification plan CO-I271, Phase 7 (U6) §9.4. The source of truth is the mono repo's
 * `packages/schemas/src/roles/registry.ts` and `roles/derive.ts`; this file is a deliberate copy of
 * the three facts billing actually needs, the role names, the v1 role each one maps to, and
 * whether the role is paid, because the two repos do not share a package and billing must not gain
 * a dependency on the dashboard build to write a role.
 *
 * What a copy costs and why it is still the right shape:
 *
 * - It can drift. `role-v2.test.ts` pins the parts that matter (19 entries, every v2 role maps to a
 *   legal v1 role, the eXp tiers are distinct) so drift is a red test rather than a wrong write.
 * - It is small and closed. Roles change monthly at most, and a new role that billing never writes
 *   costs nothing to omit until a product sells it.
 *
 * **The whole point of the column** (plan Decision 3): `AGENT_EXP_PRO` and `AGENT_EXP_ELITE` are
 * both `role = AGENT`, `is_premium = 1` in v1. On the legacy pair they are the same user and the
 * same product; on `role_v2` they are a $49 subscription and a $299 one. Every comparison in this
 * repo that used to be made on `(role, is_premium)` and needs to tell tiers apart is made here.
 *
 * Phase 9 (U91) deletes the legacy half of this file: `LEGACY_OF`, `deriveRoleV2FromLegacy` and
 * `bitsOf` exist only while `Users.role` and `Users.is_premium` are still written.
 */

/** The 13 legacy roles. `Users.role` is `varchar(45)` with no check constraint, so this is the only list there is. */
export const ROLE_V1_VALUES = [
  "MASTER",
  "ADMIN",
  "SUPER",
  "WLADMIN",
  "AGENT",
  "TEAMOPS",
  "TEAMOWNER",
  "INVESTOR",
  "INVITEDINVESTOR",
  "CUSTOMER",
  "LENDER",
  "SHELL",
  "HOMEUPTICK",
] as const

export type RoleV1 = (typeof ROLE_V1_VALUES)[number]

/**
 * The 19 registry roles, in the registry's own order (scope, then tier).
 *
 * `AGENT` is in the list and is **not assignable**: it stays legal so a legacy write can never
 * produce an unknown role (invariant I1), but nothing should ever deliberately put a user on it.
 */
export const ROLE_V2_VALUES = [
  "MASTER",
  "ADMIN",
  "SUPER",
  "WLADMIN",
  "AGENT",
  "AGENT_EXP_GUEST",
  "AGENT_FREE",
  "AGENT_LITE",
  "AGENT_EXP_PRO",
  "AGENT_PREMIUM",
  "AGENT_EXP_ELITE",
  "TEAMOPS",
  "TEAMOWNER",
  "SHELL",
  "HOMEUPTICK",
  "INVESTOR",
  "INVITEDINVESTOR",
  "CUSTOMER",
  "LENDER",
] as const

export type RoleV2 = (typeof ROLE_V2_VALUES)[number]

interface RoleEntry {
  /** The v1 role this role resolves to. Total by construction: plan invariant I2. */
  legacy: RoleV1
  /** May a product or an admin deliberately put a user on this role? */
  assignable: boolean
  /** Does holding this role mean the user is paying? Drives the lapse rule and `ever_paid`. */
  paid: boolean
}

export const ROLES_V2: Record<RoleV2, RoleEntry> = {
  MASTER: { legacy: "MASTER", assignable: true, paid: false },
  ADMIN: { legacy: "ADMIN", assignable: true, paid: false },
  SUPER: { legacy: "SUPER", assignable: true, paid: false },
  WLADMIN: { legacy: "WLADMIN", assignable: true, paid: false },
  AGENT: { legacy: "AGENT", assignable: false, paid: false },
  AGENT_EXP_GUEST: { legacy: "AGENT", assignable: true, paid: false },
  AGENT_FREE: { legacy: "AGENT", assignable: true, paid: false },
  AGENT_LITE: { legacy: "AGENT", assignable: true, paid: true },
  AGENT_EXP_PRO: { legacy: "AGENT", assignable: true, paid: true },
  AGENT_PREMIUM: { legacy: "AGENT", assignable: true, paid: true },
  AGENT_EXP_ELITE: { legacy: "AGENT", assignable: true, paid: true },
  TEAMOPS: { legacy: "TEAMOPS", assignable: true, paid: false },
  TEAMOWNER: { legacy: "TEAMOWNER", assignable: true, paid: false },
  SHELL: { legacy: "SHELL", assignable: true, paid: false },
  HOMEUPTICK: { legacy: "HOMEUPTICK", assignable: true, paid: false },
  INVESTOR: { legacy: "INVESTOR", assignable: true, paid: false },
  INVITEDINVESTOR: { legacy: "INVITEDINVESTOR", assignable: true, paid: false },
  CUSTOMER: { legacy: "CUSTOMER", assignable: true, paid: false },
  LENDER: { legacy: "LENDER", assignable: true, paid: false },
}

/** The roles a product's `user_config.role_v2` may name. */
export const ASSIGNABLE_ROLE_V2 = ROLE_V2_VALUES.filter((role) => ROLES_V2[role].assignable)

export const isRoleV2 = (value: unknown): value is RoleV2 =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ROLES_V2, value)

/** The v1 role a v2 role resolves to. Cannot fail: invariant I2. */
export const legacyOf = (role: RoleV2): RoleV1 => ROLES_V2[role].legacy

export const isPaidRoleV2 = (role: RoleV2): boolean => ROLES_V2[role].paid

/** The tier bits a `role_v2` implies, or `null` for a role outside the AGENT family, which implies nothing about them. */
export const bitsOf = (role: RoleV2): { is_premium: 0 | 1 } | null => {
  if (legacyOf(role) !== "AGENT") return null
  return { is_premium: role === "AGENT_PREMIUM" || role === "AGENT_EXP_ELITE" ? 1 : 0 }
}

/**
 * What a legacy `(role, is_premium)` pair means as a `role_v2`.
 *
 * The mono repo's `deriveV2FromLegacy(null, role, bits)`, with the guard argument dropped because
 * billing derives from a **product's** config, where there is no "current role" to guard against.
 * Identity for twelve of the thirteen v1 roles; `AGENT` means `AGENT_PREMIUM` when the premium bit
 * is set and `AGENT_FREE` otherwise.
 *
 * **It can never return an eXp tier**, and that is deliberate, not an omission. `(AGENT, 1)` is
 * ambiguous between `AGENT_PREMIUM` and `AGENT_EXP_ELITE`, that ambiguity is the defect Q9 names,
 * so the derivation answers with the platform-wide tier, the one every existing product actually
 * sells. An eXp tier only ever arrives by someone naming it, which until Phase 7.4 settles eXp
 * pricing means a hand edit of a product, never a backfill and never a signup.
 *
 * `is_lite` is not a parameter because no product config carries it: `ProductUserConfig` has only
 * `is_premium`. A Lite agent is made by the dashboard, not bought here.
 */
export const deriveRoleV2FromLegacy = (
  role: string | null | undefined,
  isPremium?: number | boolean | null
): RoleV2 | null => {
  if (!role || !(ROLE_V1_VALUES as readonly string[]).includes(role)) return null
  if (role !== "AGENT") return role as RoleV2
  return Number(isPremium ?? 0) > 0 ? "AGENT_PREMIUM" : "AGENT_FREE"
}

/**
 * The role a lapse should leave a user on, or `null` when the role must not be touched.
 *
 * This is the faithful translation of what `DOWNGRADE_TO_FREE` does **today**: it clears
 * `is_premium` and leaves `role` alone. Turning that into "set `AGENT_FREE`" unconditionally would
 * be a behavior change for every non-agent, a lapsing INVESTOR or LENDER would be walked into the
 * agent family, which no code does today and nobody asked for. So the answer is `AGENT_FREE` for
 * the AGENT family and `null`, meaning "clear the bit and leave the role", for everyone else.
 *
 * Plan §9.5 replaces this with the white label's `downgrade_role_v2`, which is what lets eXp land a
 * lapsed Pro on `AGENT_EXP_GUEST` instead of a CashOffers free account they never signed up for.
 * That column does not exist yet; when it does, it takes precedence over this function and this
 * function becomes its default.
 */
export const downgradeRoleV2For = (current: RoleV2 | null | undefined): RoleV2 | null => {
  if (!current || legacyOf(current) !== "AGENT") return null
  return "AGENT_FREE"
}

/**
 * The role a product's `user_config` puts a subscriber on.
 *
 * `role_v2` when the product carries one, the legacy pair derived when it does not. The fallback is
 * not a convenience: it is what lets this repo deploy before the backfill has run and before the
 * dashboard form has shipped (plan §9.4 "Order"). Plan Phase 9 (U91) deletes the second line, and
 * nothing else about this function changes.
 *
 * Structural parameter rather than `ProductUserConfig` so the vocabulary module stays free of a
 * dependency on the product types that depend on it.
 */
export const resolveUserConfigRoleV2 = (
  config: { role_v2?: string | null; role?: string | null; is_premium?: number | null } | null | undefined
): RoleV2 | null => {
  if (!config) return null
  if (isRoleV2(config.role_v2)) return config.role_v2
  return deriveRoleV2FromLegacy(config.role, config.is_premium)
}

/**
 * The role a user is on, as best this repo can tell.
 *
 * `Users.role_v2` when the main API returns it, the legacy pair derived when it does not, the same
 * fallback for the same reason, one column further out. It is the read half of every comparison
 * §9.4 moves onto `role_v2`: a comparison is only as good as both sides of it, and a `null` here
 * would make every user look like they needed an update.
 */
export const resolveUserRoleV2 = (
  user: { role_v2?: string | null; role?: string | null; is_premium?: number | boolean | null } | null | undefined
): RoleV2 | null => {
  if (!user) return null
  if (isRoleV2(user.role_v2)) return user.role_v2
  return deriveRoleV2FromLegacy(
    user.role,
    user.is_premium === true ? 1 : user.is_premium === false ? 0 : user.is_premium
  )
}
