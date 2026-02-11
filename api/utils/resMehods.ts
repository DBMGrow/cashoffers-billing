import { db } from "@/lib/database"

export type LogMessage = string | object | null | undefined

/**
 * Middleware that adds methods to the res object for additional functionality like logging
 */
export const resMethods = (req: any, res: any, next: Function) => {
  res.log = (...args: LogMessage[]) => {
    const messages = args.slice(0, -1) as LogMessage[]

    res.onFinish("log event", async () => {
      const message = messages.map((msg) => (typeof msg === "string" ? msg : JSON.stringify(msg))).join(" ")

      console.log(message)

      const insertData = {
        created: new Date(),
        created_user_id: req?.user?.user_id ?? 0,
        level: "BILLING",
        digest_id: req.id,
        message,
      } as any

      await db //
        .insertInto("LogEntries")
        .values(insertData)
        .execute()
    })
  }

  next()
}
