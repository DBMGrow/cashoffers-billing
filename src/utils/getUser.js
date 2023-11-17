import fetch from "node-fetch"

export default async function getUser(req, user_id, options) {
  const api_token = req.headers["x-api-token"]
  const { allowSelf = false } = options || {}

  try {
    if (!api_token) throw new Error("0000B: Unauthorized")
    if (!user_id && !allowSelf) throw new Error("0000C: user_id is required")

    const userUrl =
      allowSelf && !user_id //
        ? process.env.API_URL + "/users"
        : process.env.API_URL + "/users/" + user_id

    const user = await fetch(userUrl, {
      headers: {
        "x-api-token": api_token,
      },
    })

    if (!user.ok) throw new Error("0000D: Error fetching the user")

    return await user.json()
  } catch (error) {
    console.error(error.message)
    return { success: "error", error: error.message }
  }
}
