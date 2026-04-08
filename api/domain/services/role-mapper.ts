/**
 * Role Mapping Service
 *
 * Handles special role mapping logic when transitioning between subscription types.
 * This ensures users get the correct role when upgrading/downgrading between
 * single and team plans.
 */

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
