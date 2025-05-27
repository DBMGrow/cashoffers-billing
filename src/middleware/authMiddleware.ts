import getUser from "../utils/getUser"
import { NextFunction, Req, Res } from "../lib/types"

interface Options {
  allowSelf?: boolean
}

export default function authMiddleware(permissions: string[] | string, options?: Options) {
  if (permissions && !Array.isArray(permissions)) permissions = [permissions]
  const { allowSelf = false } = options || {}

  return async function (req: Req, res: Res, next: NextFunction) {
    let user_id = null
    switch (req.method) {
      case "GET":
        user_id = req?.params?.user_id || req?.query?.user_id
        break
      case "POST":
      case "PUT":
        user_id = req?.body?.user_id
        break
    }

    if (allowSelf && !user_id) {
      let self_user_id = await getUser(req, null, { allowSelf: true })
      if (self_user_id?.success === "success") user_id = self_user_id?.user_id
      else return res.json({ success: "error", error: "0000Z: Unauthorized" + JSON.stringify(self_user_id) })
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

    req.user = user?.data
    req.token_owner = token_owner?.data

    next()
  }
}
