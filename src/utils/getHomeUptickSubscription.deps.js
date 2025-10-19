import { db } from "@/lib/database"
import axios from "axios"

/**
 * Retrieves a user from the database by their user ID.
 *
 * @param {string|number} user_id - The unique identifier of the user to fetch.
 * @returns {Promise<Object|null>} A promise that resolves to the user object if found, or null if not found.
 */
export const getUserFromDB = async (user_id) => {
  const user = await db.selectFrom("Users").where("user_id", "=", user_id).selectAll().executeTakeFirst()

  return user || null
}

/**
 * Retrieves the active Homeuptick subscription for a given user from the database.
 *
 * @param {string|number} user_id - The unique identifier of the user.
 * @returns {Promise<null | import { HomeuptickSubscriptions } from "./lib/db.d">} A promise that resolves to the subscription object if found, or null if not found.
 */
export const getSubscriptionFromDB = async (user_id) => {
  const subscription = await db
    .selectFrom("Homeuptick_Subscriptions")
    .where("user_id", "=", user_id)
    .where("active", "=", 1)
    .selectAll()
    .executeTakeFirst()

  return subscription || null
}

/**
 * Retrieves the total number of clients from the HomeUptick API.
 *
 * @param {string} apiKey - The API key used for authentication.
 * @returns {Promise<Object>} A promise that resolves to the response containing the clients count.
 */
export const getClientsCount = async (apiKey) => {
  const clientsCount = await axios.get(`${process.env.HOMEUPTICK_URL}/api/clients/count`, {
    headers: {
      "x-api-key": apiKey,
    },
  })

  return clientsCount.data
}
