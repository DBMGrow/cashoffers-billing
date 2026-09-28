import { userApiClient } from "@api/lib/services"
import { resolveUserRoleV2, type RoleV2 } from "@api/domain/services/role-v2"

/**
 * The signed-in user's `role_v2`, for the manage routes' offering decisions.
 *
 * The auth context carries only the legacy `role`, and billing's `Users` table types predate the
 * `role_v2` column, so the role comes from the main API (`GET /users/:id`), which returns it. The
 * legacy pair is the fallback only when the main API has no such user; it cannot express an eXp
 * tier, so a Guest reads as `AGENT_FREE` there.
 *
 * A failed lookup throws rather than falling back: the fallback would read a Guest as a free agent
 * and offer them HomeUptick-only, which is the one answer a Guest must never get. The routes turn
 * the throw into an error response, and the account site lands on the dashboard.
 */
export async function resolveSignedInRoleV2(
  user: { user_id: number; role?: string | null },
  isPremium: number | null | undefined
): Promise<RoleV2 | null> {
  const apiUser = await userApiClient.getUser(user.user_id)
  return resolveUserRoleV2(apiUser ?? { role: user.role, is_premium: isPremium })
}
