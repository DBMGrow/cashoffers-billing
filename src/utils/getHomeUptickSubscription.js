import { db } from "@/lib/database"
import axios from "axios"

/**
 * Represents a HomeUptick subscription.
 * @typedef {Object} HomeUptickSubscription
 * @property {string} id - The subscription ID.
 * @property {string} user_id - The user ID.
 * @property {number} amount - The subscription amount.
 * @property {string} tier - The subscription tier.
 */

/**
 * Gets the HomeUptick subscription for a user, including the amount and tier
 *
 * @param {*} user_id
 *
 * @returns {Promise<null | HomeUptickSubscription>} The HomeUptick subscription or null if not found.
 */
const getHomeUptickSubscription = async (user_id) => {
  const user = await db.selectFrom("Users").where("user_id", "=", user_id).selectAll().executeTakeFirst()

  if (!user?.active) return null // if user is inactive, we're not gonna charge them

  const subscription = await db
    .selectFrom("Homeuptick_Subscriptions")
    .where("user_id", "=", user_id)
    .where("active", "=", 1)
    .selectAll()
    .executeTakeFirst()

  if (!subscription) return null

  const clientsCount = await axios.get(`${process.env.HOMEUPTICK_URL}/api/clients/count`, {
    headers: {
      "x-api-key": user?.api_token,
    },
  })

  subscription.price_per_tier

  const count = clientsCount?.data?.count || 0

  if (!count) return null // if they have no clients, we're not gonna charge them

  // Tier 1 = base tier (Normally 500, but based on subscription.base_contacts)
  // Tier X = base tier + (X - 1) * subscriptions.contacts_per_tier
  // Tier 1 cost = 0 — included in base price
  // Tier X cost = (X - 1) * subscriptions.price_per_tier

  let tier = 1
  if (count > subscription.base_contacts) {
    tier = Math.ceil((count - subscription.base_contacts) / subscription.contacts_per_tier) + 1
  }

  const amount = (tier - 1) * subscription.price_per_tier + subscription.base_price

  return {
    id: subscription.id,
    user_id: subscription.user_id,
    amount,
    tier,
  }
}

export default getHomeUptickSubscription
