/**
 * Role Mapping Service
 *
 * Handles special role mapping logic when transitioning between subscription types.
 * This ensures users get the correct role when upgrading/downgrading between
 * single and team plans.
 */

import type { RoleV2 } from "./role-v2"

export interface RoleTransition {
  /** Is the current subscription a team plan? */
  fromIsTeamPlan: boolean
  /** Is the new subscription a team plan? */
  toIsTeamPlan: boolean
  /** Base role from the new product configuration */
  baseRole: string
}

/**
 * Determine the correct role when transitioning between subscription types.
 *
 * Rules:
 * - Upgrading from single to team plan → role becomes "TEAMOWNER"
 * - Downgrading from team to single plan → role becomes "AGENT"
 * - No plan type change → use the product's configured base role
 *
 * @param transition - The transition details
 * @returns The role to assign to the user
 */
export function mapRoleForTransition(transition: RoleTransition): string {
  const { fromIsTeamPlan, toIsTeamPlan, baseRole } = transition

  // Upgrading to team plan
  if (!fromIsTeamPlan && toIsTeamPlan) {
    return "TEAMOWNER"
  }

  // Downgrading from team plan to single
  if (fromIsTeamPlan && !toIsTeamPlan) {
    return "AGENT"
  }

  // No plan type change, use base role from product
  return baseRole
}

/**
 * The `role_v2` half of the same rule, RBAC unification plan CO-I271 §9.4.
 *
 * Two differences from `mapRoleForTransition`, both forced by the vocabulary rather than chosen:
 *
 * - Leaving a team plan returns the **new product's** role, not a literal `AGENT`. `AGENT` is a
 *   legal role but an unassignable one: it is what a user is before anyone has said which tier they
 *   are on, and deliberately putting a paying subscriber there would leave them with a free agent's
 *   capabilities. The product they just moved onto is the thing that knows what they bought, and in
 *   every existing case it says the same thing the old literal did, a single plan's config is
 *   `AGENT` + `is_premium 1`, which derives to `AGENT_PREMIUM`.
 * - `TEAMOWNER` is unchanged, because team roles are not multiplied by tier (plan Decision 4).
 */
export function mapRoleV2ForTransition(transition: {
  fromIsTeamPlan: boolean
  toIsTeamPlan: boolean
  baseRoleV2: RoleV2
}): RoleV2 {
  const { fromIsTeamPlan, toIsTeamPlan, baseRoleV2 } = transition

  if (!fromIsTeamPlan && toIsTeamPlan) return "TEAMOWNER"

  return baseRoleV2
}
