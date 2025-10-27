import express, { NextFunction } from "express"
import CodedError from "@/utils/CodedError"
import { Req, Res, Session, PagesResponse, LogConfig, LogMessage } from "./types"
import { db } from "@/lib/database"
import { sql } from "kysely"
import sendAlert from "@/lib/sendAlert"

type Method = "get" | "post" | "put" | "patch" | "delete"
export type Handler = (req: Req, res: Res, next: NextFunction) => Promise<void>

interface RouteConfigOptions {}

export class RequestMethods {
  req: Req
  res: Res

  constructor(req: Req, res: Res) {
    this.req = req
    this.res = res
  }

  async getSession(): Promise<Session> {
    if (this.req.user) return this.req.user
    const apiToken = this?.req?.cookies?._api_token || this?.req?.headers?.["x-api-token"]
    if (!apiToken) throw new CodedError("Unauthorized", 401, "REQ|01")
    const user = await db
      .selectFrom("Users_Self")
      .where("api_token", "=", apiToken)
      .select([
        "Users_Self.active",
        "Users_Self.agent_user_id",
        "Users_Self.address1",
        "Users_Self.address2",
        "Users_Self.api_token",
        "Users_Self.city",
        "Users_Self.country",
        "Users_Self.created",
        "Users_Self.email",
        "Users_Self.lender_user_id",
        // "Users.integration_id",
        // "Users.integration_pk",
        "Users_Self.investor_view_address",
        "Users_Self.name",
        "Users_Self.name_broker",
        "Users_Self.name_team",
        "Users_Self.notifications_email",
        "Users_Self.notifications_email_allproperties",
        "Users_Self.notifications_email_alloffers_accept",
        "Users_Self.notifications_sms",
        "Users_Self.phone",
        "Users_Self.role",
        // "Users.reset_created",
        // "Users.reset_token",
        "Users_Self.slug",
        "Users_Self.state",
        "Users_Self.team_id",
        "Users_Self.user_id",
        "Users_Self.whitelabel_id",
        "Users_Self.zip",
        "Users_Self.is_premium",
        "Users_Self.card_id",
        "Users_Self.max_property_value",
        "Users_Self.showings_info_read",
        "Users_Self.show_welcome_tour",
      ])
      .executeTakeFirst()
    if (!user) throw new CodedError("Invalid API token", 401, "REQ|01")
    if (user.active !== 1) throw new CodedError("User is not active", 401, "REQ|01")

    let trimmedUser = {
      ...user,
      password: "",
      reset_token: "",
      reset_created: new Date(),
    }

    this.req.user = trimmedUser
    return trimmedUser
  }

  async userCan(...capabilities: string[]) {
    const user = await this.req.getSession()
    if (!user) throw new CodedError("Unauthorized", 401, "REQ|01")

    let caps = this.req.caps ?? []

    if (!caps?.length) {
      const userCapabilities = await db.selectFrom("Roles").where("role", "=", user.role).selectAll().executeTakeFirst()
      if (!userCapabilities) throw new CodedError("Unauthorized", 401, "REQ|01")

      caps = Object.keys(userCapabilities)
        .filter((key) => (key == "role" || key == "rolename" ? false : true))
        .filter((key: string) => userCapabilities[key as keyof typeof userCapabilities] === 1)
        .map((key) => key)
    }

    this.req.caps = caps
    return capabilities.every((capability) => caps.includes(capability))
  }

  /**
   * Used to set the current session to the system. Used by webhooks and other system level requests.
   */
  async setSystemSession() {
    const user = await db.selectFrom("Users_Self").where("user_id", "=", 3).selectAll().executeTakeFirst()
    if (!user) throw new CodedError("System user not found", 500, "REQ|02")

    this.req.user = user
  }
}

export class ResponseMethods {
  req: Req
  res: Res

  constructor(req: Req, res: Res) {
    this.req = req
    this.res = res
  }

  success = <T>(data: T, message: string = "Success", pages?: PagesResponse, flattenBody?: boolean) => {
    let responseBody: any = {
      data,
      message,
      pages,
      success: "success",
      digest_id: this.req.digest_id,
      warnings: this.res.warnings || undefined,
      info: this.res.notes || undefined,
    }

    if (flattenBody) {
      responseBody = {
        message,
        success: "success",
        digest_id: this.req.digest_id,
        warnings: this.res.warnings || undefined,
        info: this.res.notes || undefined,
        ...data,
      }
    }

    this.res //
      .status(200)
      .json(responseBody)
      .end()
  }

  warn = (message: string) => {
    if (!this.res.warnings?.length) this.res.warnings = []
    this.res.warnings.push(message)
  }

  info = (message: string) => {
    if (!this?.res?.notes?.length) this.res.notes = []
    this.res.notes.push(message)
  }

  error(error: Error) {
    console.error("an error has occurred: ", error)

    let status = (error as any)?.code ?? 500
    if (typeof status !== "number") {
      console.error("error code is not a number: ", status)
      status = 500
    }

    void this.insertErrorInstance(error, status)

    return this.res.status(status ?? 500).json({
      success: false,
      error: error.message,
      digest_id: this.req.digest_id,
      warnings: this.res.warnings || undefined,
      info: this.res.notes || undefined,
    })
  }

  insertErrorInstance(error: Error, status: number) {
    if (process.env.NODE_ENV === "test") return
    if (status < 400) return

    this.onFinish("log error instances", async () => {
      let signature = `${error.message} | ${error.stack}`
      signature = signature.substring(0, 500)

      const upsertResult = await db
        .insertInto("ErrorTypes")
        .values({
          error_signature: signature,
          total_count: 1,
          count_today: 1,
          last_occurrence: new Date(),
          first_occurrence: new Date(),
        })
        .onDuplicateKeyUpdate({
          count_today: sql`ErrorTypes.count_today + 1`,
          total_count: sql`ErrorTypes.total_count + 1`,
          last_occurrence: new Date(),
          error_type_id: sql`LAST_INSERT_ID(\`error_type_id\`)`,
        })
        .executeTakeFirst()

      const insertID = Number(upsertResult.insertId)

      await db
        .insertInto("ErrorInstances")
        .values({
          code: status,
          error_type_id: insertID,
          message: error.message,
          body: JSON.stringify(this.req.body),
          api_token: this.req.user?.api_token || null,
          created: new Date(),
          digest_id: this.req.digest_id,
          endpoint: this.req.originalUrl,
          method: this.req.method,
          stack: error.stack,
        })
        .executeTakeFirst()

      const todayErrorCount = await db
        .selectFrom("ErrorTypes")
        .where("error_type_id", "=", insertID)
        .select(["count_today"])
        .executeTakeFirst()

      if (Number(todayErrorCount?.count_today) === 5) {
        await sendAlert(`⚠️ An Error has occurred multiple times today: 
- Error Type ID: ${insertID}
- Error Message: ${error.message}
- Error Stack: ${error.stack}
`)
      }
    })
  }

  async onFinish(name: string, callback: () => Promise<void>): Promise<void> {
    // if testing, run the callback immediately
    if (process.env.NODE_ENV === "test") return await callback()

    if (!this.res._finishCallbacks) {
      this.res._finishCallbacks = []
      this.res.on("finish", async () => {
        this.res._finished = true
        this.res._finishCallbacks.forEach(async (callback: any) => {
          try {
            await callback.cb()
          } catch (error) {
            console.error(`Error in onFinish callback "${callback.name}"`, error)
          }
        })
      })
    }

    if (this.res._finished) {
      await callback()
    } else {
      this.res._finishCallbacks.push({
        cb: callback,
        name,
      })
    }
  }

  log(...args: [...message: LogMessage[], config: LogConfig]): void {
    const config = args[args.length - 1] as LogConfig
    const messages = args.slice(0, -1) as LogMessage[]
    if (process.env.NODE_ENV === "test") return console.log(...messages)

    this.onFinish("log event", async () => {
      const message = messages.map((msg) => (typeof msg === "string" ? msg : JSON.stringify(msg))).join(" ")

      console.log(message)

      const insertData = {
        created: new Date(),
        created_user_id: this.req.user?.user_id ?? 0,
        level: "INFO",
        digest_id: this.req.digest_id,
        message,
      } as any

      if (config?.table_id) insertData.table_id = config.table_id
      if (config?.tablename) insertData.tablename = config.tablename
      if (config?.level) insertData.level = config.level

      await db //
        .insertInto("LogEntries")
        .values(insertData)
        .execute()
    })
  }
}

class Router {
  router: express.Router
  app: express.Application

  constructor() {
    this.router = express.Router()
    this.app = express()
  }

  route(method: Method, path: string, config: RouteConfigOptions, ...handlers: Handler[]) {
    const wrappedHandlers = handlers.map((handler) => async (req: Req, res: Res, next: NextFunction) => {
      const requestMethods = new RequestMethods(req, res)
      const responseMethods = new ResponseMethods(req, res)

      req.getSession = requestMethods.getSession.bind(requestMethods)
      req.userCan = requestMethods.userCan.bind(requestMethods)
      req.setSystemSession = requestMethods.setSystemSession.bind(requestMethods)
      res.success = responseMethods.success.bind(responseMethods)
      res.error = responseMethods.error.bind(responseMethods)
      res.onFinish = responseMethods.onFinish.bind(responseMethods)
      res.log = responseMethods.log.bind(responseMethods)
      res.warn = responseMethods.warn.bind(responseMethods)
      res.info = responseMethods.info.bind(responseMethods)

      try {
        await handler(req, res, next)
      } catch (error: any) {
        res.error(error)
      }
    })

    return this.router[method](path, ...(wrappedHandlers as any))
  }

  get(path: string, config: {}, ...handlers: Handler[]) {
    this.route("get", path, config, ...handlers)
  }

  post(path: string, config: {}, ...handlers: Handler[]) {
    this.route("post", path, config, ...handlers)
  }

  put(path: string, config: {}, ...handlers: Handler[]) {
    this.route("put", path, config, ...handlers)
  }

  patch(path: string, config: {}, ...handlers: Handler[]) {
    this.route("patch", path, config, ...handlers)
  }

  delete(path: string, config: {}, ...handlers: Handler[]) {
    this.route("delete", path, config, ...handlers)
  }
}

export default Router
