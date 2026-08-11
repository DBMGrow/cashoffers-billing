import { Context } from "hono"
import type { HonoVariables } from "@api/types/hono"
import { subscriptionRepository } from "@api/lib/repositories"

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
  try {
    // Find subscription
    const subscription = await subscriptionRepository.findById(subscriptionId)
    if (!subscription) {
      return {
        authorized: false,
        errorResponse: c.json({ success: "error", error: "Subscription not found" }, 404),
      }
    }

    // Ownership is decided on the AUTHENTICATED caller, never the target user.
    //
    // `c.get("user")` is the *claimed* identity — the middleware resolves it from
    // a caller-supplied `user_id`. Comparing that against the subscription asked
    // "does this subscription belong to whoever the request says it belongs to?",
    // which is true by construction for any victim's subscription. The token
    // owner is the only identity the caller cannot choose.
    const tokenOwner = c.get("token_owner")
    const tokenOwnerCaps = tokenOwner?.capabilities || []

    const isOwner = tokenOwner?.user_id === subscription.user_id
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
