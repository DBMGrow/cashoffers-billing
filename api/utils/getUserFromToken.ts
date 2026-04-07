import { db } from "@api/lib/database"

/**
 * User data with capabilities from database
 */
export interface UserWithCapabilities {
  user_id: number
  email: string
  name: string | null
  role: string
  active: number
  api_token: string | null
  whitelabel_id: number
  capabilities: string[]
}

/**
 * Fetch user data and capabilities from database using API token
 * Joins Users with Roles to get permission capabilities
 */
export async function getUserFromToken(
  apiToken: string | null
): Promise<UserWithCapabilities | null> {
  if (!apiToken) {
    return null
  }

  try {
    const result = await db
      .selectFrom("Users")
      .innerJoin("Roles", "Users.role", "Roles.role")
      .select([
        "Users.user_id",
        "Users.email",
        "Users.name",
        "Users.role",
        "Users.active",
        "Users.api_token",
        "Users.whitelabel_id",
      ])
      .select((eb) => [
        // Select all role permission fields dynamically
        "Roles.payments_create",
        "Roles.payments_read",
        "Roles.payments_read_all",
        "Roles.payments_delete",
        "Roles.payments_delete_all",
        "Roles.properties_create",
        "Roles.properties_read",
        "Roles.properties_read_all",
        "Roles.properties_update",
        "Roles.properties_update_all",
        "Roles.properties_delete",
        "Roles.properties_delete_all",
        "Roles.properties_unlock",
        "Roles.properties_assign",
        "Roles.properties_read_investor",
        "Roles.properties_read_all_investor",
        "Roles.offers_create",
        "Roles.offers_read",
        "Roles.offers_read_all",
        "Roles.offers_update",
        "Roles.offers_update_all",
        "Roles.offers_delete",
        "Roles.offers_delete_all",
        "Roles.buyboxes_create",
        "Roles.buyboxes_read",
        "Roles.buyboxes_read_all",
        "Roles.buyboxes_update",
        "Roles.buyboxes_update_all",
        "Roles.buyboxes_delete",
        "Roles.users_create",
        "Roles.users_create_all",
        "Roles.users_read",
        "Roles.users_read_all",
        "Roles.users_update",
        "Roles.users_update_all",
        "Roles.users_delete",
        "Roles.users_delete_all",
        "Roles.teams_create",
        "Roles.teams_read",
        "Roles.teams_read_all",
        "Roles.teams_update",
        "Roles.teams_delete",
        "Roles.alerts_create",
        "Roles.alerts_read_all",
        "Roles.alerts_update",
        "Roles.settings",
      ])
      .where("Users.api_token", "=", apiToken)
      .executeTakeFirst()

    if (!result) {
      return null
    }

    // Build capabilities array from role permissions
    const capabilities: string[] = []
    const roleFields = [
      "payments_create",
      "payments_read",
      "payments_read_all",
      "payments_delete",
      "payments_delete_all",
      "properties_create",
      "properties_read",
      "properties_read_all",
      "properties_update",
      "properties_update_all",
      "properties_delete",
      "properties_delete_all",
      "properties_unlock",
      "properties_assign",
      "properties_read_investor",
      "properties_read_all_investor",
      "offers_create",
      "offers_read",
      "offers_read_all",
      "offers_update",
      "offers_update_all",
      "offers_delete",
      "offers_delete_all",
      "buyboxes_create",
      "buyboxes_read",
      "buyboxes_read_all",
      "buyboxes_update",
      "buyboxes_update_all",
      "buyboxes_delete",
      "users_create",
      "users_create_all",
      "users_read",
      "users_read_all",
      "users_update",
      "users_update_all",
      "users_delete",
      "users_delete_all",
      "teams_create",
      "teams_read",
      "teams_read_all",
      "teams_update",
      "teams_delete",
      "alerts_create",
      "alerts_read_all",
      "alerts_update",
      "settings",
    ] as const

    // Add capability if role has permission (value is 1)
    for (const field of roleFields) {
      if (result[field] === 1) {
        capabilities.push(field)
      }
    }

    return {
      user_id: result.user_id,
      email: result.email,
      name: result.name,
      role: result.role,
      active: result.active,
      api_token: result.api_token,
      whitelabel_id: result.whitelabel_id,
      capabilities,
    }
  } catch (error) {
    console.error("Error fetching user from token:", error)
    return null
  }
}

/**
 * Fetch user data by user_id (for looking up target users)
 */
export async function getUserById(
  userId: number
): Promise<Omit<UserWithCapabilities, "capabilities"> | null> {
  try {
    const result = await db
      .selectFrom("Users")
      .select([
        "user_id",
        "email",
        "name",
        "role",
        "active",
        "api_token",
        "whitelabel_id",
      ])
      .where("user_id", "=", userId)
      .executeTakeFirst()

    return result || null
  } catch (error) {
    console.error("Error fetching user by ID:", error)
    return null
  }
}
