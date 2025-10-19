import { getClientsCount, getSubscriptionFromDB, getUserFromDB } from "@/utils/getHomeUptickSubscription.deps"

/**
 * Represents a HomeUptick subscription.
 * @typedef {Object} HomeUptickSubscription
 * @property {string} id - The subscription ID.
 * @property {string} user_id - The user ID.
 * @property {number} contacts - The number of contacts.
 * @property {number} contactsOnThisTier - The number of contacts on this tier.
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
  const user = await getUserFromDB(user_id)
  if (!user?.active) {
    console.log("User not found or inactive:", user_id)
    return null // if user is inactive, we're not gonna charge them
  }

  const subscription = await getSubscriptionFromDB(user_id)
  if (!subscription) {
    console.log("No active subscription found for user:", user_id)
    return null
  }

  const clientsCount = await getClientsCount(user.homeuptick_api_key)
  const count = clientsCount?.data?.count || 0

  if (!count) {
    console.log("No clients found for user:", user_id)
    return null // if they have no clients, we're not gonna charge them
  }

  let tier = 1

  if (count > subscription.base_contacts) {
    tier = Math.ceil((count - subscription.base_contacts) / subscription.contacts_per_tier) + 1
  }

  const amount = (tier - 1) * subscription.price_per_tier
  const contactsOnThisTier = subscription.base_contacts + (tier - 1) * subscription.contacts_per_tier

  return {
    id: subscription.id,
    user_id: subscription.user_id,
    contacts: count,
    contactsOnThisTier,
    amount,
    tier,
  }
}

export default getHomeUptickSubscription
