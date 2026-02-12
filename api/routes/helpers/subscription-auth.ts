import { Context } from "hono"
import type { HonoVariables } from "@api/types/hono"
import { getContainer } from "@api/container"

/**
 * Check if user is authorized to perform subscription operations
 * Returns error response if not authorized, otherwise returns subscription and auth status
 */
export async function checkSubscriptionAuthorization(
  c: Context<{ Variables: HonoVariables }>,
  subscriptionId: number
): Promise<{
  authorized: boolean
  subscription?: any
  errorResponse?: any
}> {
  const container = getContainer()

  try {
    // Find subscription
    const subscription = await container.repositories.subscription.findById(subscriptionId)
    if (!subscription) {
      return {
        authorized: false,
        errorResponse: c.json({ success: "error", error: "Subscription not found" }, 404),
      }
    }

    // Get user and token owner from context
    const user = c.get("user")
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    // Check if user is owner or has admin permission
    const isOwner = user?.user_id === subscription.user_id
    const hasPermission = tokenOwnerCaps.includes("payments_create")

    if (!isOwner && !hasPermission) {
      return {
        authorized: false,
        errorResponse: c.json({ success: "error", error: "Unauthorized" }, 403),
      }
    }

    return {
      authorized: true,
      subscription,
    }
  } catch (error) {
    return {
      authorized: false,
      errorResponse: c.json({ success: "error", error: "Internal server error" }, 500),
    }
  }
}
