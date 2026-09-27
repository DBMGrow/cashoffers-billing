import { describe, it, expect } from "vitest"
import {
  ROLE_V1_VALUES,
  ROLE_V2_VALUES,
  ROLES_V2,
  ASSIGNABLE_ROLE_V2,
  isRoleV2,
  legacyOf,
  isPaidRoleV2,
  bitsOf,
  deriveRoleV2FromLegacy,
  downgradeRoleV2For,
  validDowngradeRoleV2,
  userConfigRoleMismatch,
  alignUserConfigRoles,
  alignProductDataRoles,
} from "./role-v2"

/**
 * This file is a mirror of the mono repo's role registry, so these tests are drift detectors, not
 * behavior tests. They pin the properties the registry itself asserts (plan invariants I1/I2) plus
 * the one fact the whole of §9.4 rests on: Pro and Elite are different roles.
 */
describe("role-v2 vocabulary (mirror of packages/schemas/src/roles/registry.ts)", () => {
  it("has the 19 registry roles and the 13 legacy roles", () => {
    expect(ROLE_V2_VALUES).toHaveLength(19)
    expect(ROLE_V1_VALUES).toHaveLength(13)
    expect(Object.keys(ROLES_V2).sort()).toEqual([...ROLE_V2_VALUES].sort())
  })

  it("maps every v2 role to a legal v1 role (invariant I2)", () => {
    const illegal = ROLE_V2_VALUES.filter((role) => !(ROLE_V1_VALUES as readonly string[]).includes(legacyOf(role)))
    expect(illegal).toEqual([])
  })

  it("keeps every v1 role a legal v2 role (invariant I1)", () => {
    const missing = ROLE_V1_VALUES.filter((role) => !isRoleV2(role))
    expect(missing).toEqual([])
  })

  it("leaves AGENT legal but unassignable", () => {
    expect(isRoleV2("AGENT")).toBe(true)
    expect(ASSIGNABLE_ROLE_V2).not.toContain("AGENT")
    expect(ASSIGNABLE_ROLE_V2).toHaveLength(18)
  })

  it("holds the three eXp tiers apart, which is the whole of Q9", () => {
    expect(ROLE_V2_VALUES).toContain("AGENT_EXP_GUEST")
    expect(ROLE_V2_VALUES).toContain("AGENT_EXP_PRO")
    expect(ROLE_V2_VALUES).toContain("AGENT_EXP_ELITE")
    // Identical on the legacy pair, which is exactly why the legacy pair cannot price them.
    expect(legacyOf("AGENT_EXP_PRO")).toBe("AGENT")
    expect(legacyOf("AGENT_EXP_ELITE")).toBe("AGENT")
    expect(isPaidRoleV2("AGENT_EXP_PRO")).toBe(true)
    expect(isPaidRoleV2("AGENT_EXP_ELITE")).toBe(true)
  })

  it("rejects anything that is not a role", () => {
    expect(isRoleV2("AGENT_EXP_PLATINUM")).toBe(false)
    expect(isRoleV2("")).toBe(false)
    expect(isRoleV2(null)).toBe(false)
    expect(isRoleV2(undefined)).toBe(false)
    // Prototype keys are not roles.
    expect(isRoleV2("toString")).toBe(false)
  })
})

describe("deriveRoleV2FromLegacy", () => {
  it("is the identity for every v1 role except AGENT", () => {
    const wrong = ROLE_V1_VALUES.filter((role) => role !== "AGENT" && deriveRoleV2FromLegacy(role, 0) !== role)
    expect(wrong).toEqual([])
  })

  it("reads the premium bit only for AGENT", () => {
    expect(deriveRoleV2FromLegacy("AGENT", 1)).toBe("AGENT_PREMIUM")
    expect(deriveRoleV2FromLegacy("AGENT", 0)).toBe("AGENT_FREE")
    expect(deriveRoleV2FromLegacy("AGENT", undefined)).toBe("AGENT_FREE")
    expect(deriveRoleV2FromLegacy("AGENT", true)).toBe("AGENT_PREMIUM")
    // A premium LENDER is a real and common state; it says nothing about their role.
    expect(deriveRoleV2FromLegacy("LENDER", 1)).toBe("LENDER")
  })

  it("never derives an eXp tier, so no backfill and no signup can create one", () => {
    const derived = ROLE_V1_VALUES.flatMap((role) => [deriveRoleV2FromLegacy(role, 0), deriveRoleV2FromLegacy(role, 1)])
    expect(derived.filter((role) => role?.startsWith("AGENT_EXP_"))).toEqual([])
  })

  it("round-trips through the legacy role (invariant I3)", () => {
    const broken = ROLE_V1_VALUES.filter((role) => {
      const v2 = deriveRoleV2FromLegacy(role, 0)
      return !v2 || legacyOf(v2) !== role
    })
    expect(broken).toEqual([])
  })

  it("returns null for a role it does not know, rather than inventing one", () => {
    expect(deriveRoleV2FromLegacy("WIZARD", 1)).toBeNull()
    expect(deriveRoleV2FromLegacy(null)).toBeNull()
    expect(deriveRoleV2FromLegacy(undefined)).toBeNull()
    // A v2-only name is not a v1 role: the derivation is from the legacy column only.
    expect(deriveRoleV2FromLegacy("AGENT_EXP_PRO", 1)).toBeNull()
  })
})

describe("bitsOf", () => {
  it("sets the premium bit for the two premium-equivalent tiers and nothing else", () => {
    const premium = ROLE_V2_VALUES.filter((role) => bitsOf(role)?.is_premium === 1)
    expect(premium).toEqual(["AGENT_PREMIUM", "AGENT_EXP_ELITE"])
  })

  it("says nothing about the bits for a role outside the AGENT family", () => {
    // Writing is_premium = 0 for these would strip the bit from every admin, team owner and lender
    // that carries it today. Returning null is what makes that impossible to skip past.
    expect(bitsOf("LENDER")).toBeNull()
    expect(bitsOf("MASTER")).toBeNull()
    expect(bitsOf("TEAMOWNER")).toBeNull()
  })

  it("leaves AGENT_EXP_PRO unpremium, so the bits alone cannot price it", () => {
    expect(bitsOf("AGENT_EXP_PRO")).toEqual({ is_premium: 0 })
  })
})

describe("downgradeRoleV2For", () => {
  it("lands every AGENT-family tier on AGENT_FREE", () => {
    const agentTiers = ROLE_V2_VALUES.filter((role) => legacyOf(role) === "AGENT")
    const wrong = agentTiers.filter((role) => downgradeRoleV2For(role) !== "AGENT_FREE")
    expect(wrong).toEqual([])
  })

  it("leaves every other role alone, which is what DOWNGRADE_TO_FREE does today", () => {
    const touched = ROLE_V2_VALUES.filter((role) => legacyOf(role) !== "AGENT" && downgradeRoleV2For(role) !== null)
    expect(touched).toEqual([])
  })

  it("leaves an unknown current role alone rather than guessing", () => {
    expect(downgradeRoleV2For(null)).toBeNull()
    expect(downgradeRoleV2For(undefined)).toBeNull()
  })

  // CO-I271 F-S4-d (AC25): a lapsed Express Offers Pro landed on AGENT_FREE because the white
  // label's downgrade_role_v2 was never read.
  it("lands an agent on the white label's downgrade role when it names one", () => {
    expect(downgradeRoleV2For("AGENT_EXP_PRO", "AGENT_EXP_GUEST")).toBe("AGENT_EXP_GUEST")
    expect(downgradeRoleV2For("AGENT_EXP_ELITE", "AGENT_EXP_GUEST")).toBe("AGENT_EXP_GUEST")
    expect(downgradeRoleV2For("AGENT_PREMIUM", "SHELL")).toBe("SHELL")
  })

  it("keeps KW (downgrade_role_v2 AGENT_FREE) exactly where it was", () => {
    expect(downgradeRoleV2For("AGENT_PREMIUM", "AGENT_FREE")).toBe("AGENT_FREE")
  })

  it("falls back to AGENT_FREE when the white label's role is unset, unknown, unassignable, paid or a promotion", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "NOT_A_ROLE",
      "AGENT",
      "AGENT_EXP_PRO",
      "AGENT_PREMIUM",
      "ADMIN",
      "WLADMIN",
      "INVESTOR",
    ]) {
      expect(downgradeRoleV2For("AGENT_EXP_PRO", bad)).toBe("AGENT_FREE")
    }
  })

  it("still leaves a non-agent alone whatever the white label names", () => {
    expect(downgradeRoleV2For("INVESTOR", "AGENT_EXP_GUEST")).toBeNull()
    expect(downgradeRoleV2For("TEAMOWNER", "SHELL")).toBeNull()
  })
})

describe("validDowngradeRoleV2", () => {
  it("accepts exactly the unpaid assignable agent tiers and SHELL", () => {
    const accepted = ROLE_V2_VALUES.filter((role) => validDowngradeRoleV2(role) !== null)
    expect(accepted.sort()).toEqual(["AGENT_EXP_GUEST", "AGENT_FREE", "SHELL"])
  })

  it("never accepts a paid role", () => {
    expect(ROLE_V2_VALUES.filter((role) => ROLES_V2[role].paid && validDowngradeRoleV2(role) !== null)).toEqual([])
  })
})

describe("product user_config role agreement", () => {
  it("agrees when role is the legacy role of role_v2, or when only one half is named", () => {
    expect(userConfigRoleMismatch({ role_v2: "AGENT_EXP_PRO", role: "AGENT" })).toBeNull()
    expect(userConfigRoleMismatch({ role_v2: "TEAMOWNER", role: "TEAMOWNER" })).toBeNull()
    expect(userConfigRoleMismatch({ role_v2: "AGENT_EXP_PRO" })).toBeNull()
    expect(userConfigRoleMismatch({ role: "AGENT" })).toBeNull()
    expect(userConfigRoleMismatch(null)).toBeNull()
  })

  it("names the mismatch", () => {
    expect(userConfigRoleMismatch({ role_v2: "AGENT_EXP_PRO", role: "INVESTOR" })).toBe(
      'user_config.role "INVESTOR" does not match role_v2 "AGENT_EXP_PRO", which implies role "AGENT"'
    )
  })

  it("derives role from role_v2 when role is absent, and leaves everything else alone", () => {
    expect(alignUserConfigRoles({ role_v2: "AGENT_EXP_PRO" })).toEqual({ role_v2: "AGENT_EXP_PRO", role: "AGENT" })
    expect(alignUserConfigRoles({ role_v2: "TEAMOWNER" })).toEqual({ role_v2: "TEAMOWNER", role: "TEAMOWNER" })
    const legacyOnly = { role: "AGENT" }
    expect(alignUserConfigRoles(legacyOnly)).toBe(legacyOnly)
  })

  it("aligns both user_config sites of a product's data without mutating it", () => {
    const data = {
      user_config: { role_v2: "INVESTOR" },
      cashoffers: { managed: true, user_config: { role_v2: "AGENT_EXP_PRO" } },
    }
    const aligned = alignProductDataRoles(data)
    expect(aligned.user_config).toEqual({ role_v2: "INVESTOR", role: "INVESTOR" })
    expect(aligned.cashoffers.user_config).toEqual({ role_v2: "AGENT_EXP_PRO", role: "AGENT" })
    expect(data.cashoffers.user_config).toEqual({ role_v2: "AGENT_EXP_PRO" })
    expect(alignProductDataRoles(undefined)).toBeUndefined()
  })
})
