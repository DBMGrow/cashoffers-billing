import { db } from "../lib/db"
import { DB } from "../lib/db.d"
import CodedError from "../lib/CodedError"
import { Req } from "../lib/types"
import { Selectable, SelectQueryBuilder } from "kysely"

interface Options {
  allowSelf?: boolean
}

export default async function getUser(req: Req, user_id: number, options?: Options): Promise<Selectable<DB["Users"]>> {
  const api_token = req.headers["x-api-token"] || req?.cookies?._api_token
  const { allowSelf = false } = options || {}
  if (!api_token) throw new CodedError("Unauthorized", 401)
  if (!user_id && !allowSelf) throw new CodedError("0000C: user_id is required", 401)

  let userQuery: SelectQueryBuilder<DB, "Users", any>

  if (api_token) {
    userQuery = db.selectFrom("Users").where("api_token", "=", api_token).selectAll("Users")
  } else if (user_id) {
    userQuery = db.selectFrom("Users").where("user_id", "=", user_id).selectAll("Users")
  } else {
    throw new CodedError("user_id is required", 401)
  }

  const user = await userQuery.executeTakeFirst()
  if (!user) throw new CodedError("No User Found", 404)
  return await user
}
