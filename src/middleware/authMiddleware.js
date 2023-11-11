import getUser from "../utils/getUser"

export default function authMiddleware(permissions) {
  if (permissions && !Array.isArray(permissions)) permissions = [permissions]

  return async function (req, res, next) {
    let user_id = null
    switch (req.method) {
      case "GET":
        user_id = req?.params?.user_id
        break
      case "POST":
        user_id = req?.body?.user_id
        break
    }

    const user = await getUser(req, user_id)
    if (user?.success !== "success")
      return res.json({ success: "error", data: user, error: "A000", user_id, method: req.method, body: req?.body })

    const token_owner = await getUser(req, user?.user_id)
    if (token_owner.success !== "success") return res.json({ success: "error", data: token_owner, error: "A001" })

    let authCheck =
      user?.success === "success" && //
      user?.data?.user_id == user_id

    const tokenOwnerCaps = token_owner?.data?.capabilities
    let permissionsCheck = true
    if (permissions) permissionsCheck = permissions.every((permission) => tokenOwnerCaps.includes(permission))

    if (!authCheck) return res.json({ success: "error", error: "0000E: Unauthorized" })
    if (!permissionsCheck) return res.json({ success: "error", error: "0000F: Unauthorized" })

    next()
  }
}
