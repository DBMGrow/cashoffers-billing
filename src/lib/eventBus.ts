import { v4 as uuidv4 } from "uuid"
import { db } from "./database"
import { EventEmitter } from "events"
import { Req, Res, Session } from "@/lib/types"
import { RequestMethods, ResponseMethods } from "@/lib/router"
import EventPayloads from "@/lib/events"

export const eventBus = new EventEmitter()

interface EmitEventOptions<EventName extends keyof EventPayloads> {
  name: EventName
  payload: EventPayloads[EventName]
  payload_version: string
  req: {
    user?: Session
    digest_id: string
  }
  res: Res
}

export interface EmittedData<EventName extends keyof EventPayloads> {
  event_id: string
  event_name: EventName
  payload: EventPayloads[EventName]
  payload_version: string
  req: {
    user?: Session
    digest_id: string
  }
}

export const emitEvent = <EventName extends keyof EventPayloads>({
  name,
  payload,
  req,
  res,
  payload_version,
}: EmitEventOptions<EventName>) => {
  if (process.env.NODE_ENV === "test") return // don't emit events in test mode

  const event_id = uuidv4()

  const data: EmittedData<EventName> = {
    event_id,
    payload_version,
    event_name: name,
    payload,
    req,
  }

  eventBus.emit(name, data)

  void db
    .insertInto("EmittedEvents")
    .values({
      event_id,
      event_name: name,
      origin_request_id: req.digest_id,
      origin_request_user_session: JSON.stringify(req.user),
      payload: JSON.stringify(payload),
      payload_version,
    })
    .execute()
    .catch((err) => {
      console.error("Failed to write emitted event audit log:", err)
    })
}

export interface ListenToEventOptions<EventName extends keyof EventPayloads> {}

export type ListenerCallback<EventName extends keyof EventPayloads> = (
  data: EmittedData<EventName>,
  req: Req,
  res: Res
) => Promise<void | string>

const prepareReqRes = <EventName extends keyof EventPayloads>(data: EmittedData<EventName>): { req: Req; res: Res } => {
  // construct the req and res objects
  // these events happen outside the flow of the request/response cycle
  // so we need to create our own req and res objects
  const req = {
    user: data.req.user,
    digest_id: data.req.digest_id,
    method: "POST",
  } as Req
  const res = {} as Res

  const requestMethods = new RequestMethods(req, res)
  const responseMethods = new ResponseMethods(req, res)

  req.getSession = requestMethods.getSession.bind(requestMethods)
  req.userCan = requestMethods.userCan.bind(requestMethods)
  req.setSystemSession = requestMethods.setSystemSession.bind(requestMethods)
  res.onFinish = responseMethods.onFinish.bind(responseMethods)
  res.log = responseMethods.log.bind(responseMethods)
  res.on = ((event: "close", listener: () => void) => listener()) as any

  res.success = () => {
    throw new Error("Error: success() cannot be called in this context")
  }
  res.error = () => {
    throw new Error("Error: error() cannot be called in this context")
  }

  return { req, res }
}

type OneOrMany<T> = T | T[]

export const listenToEvent = async <EventName extends keyof EventPayloads>(
  listeningTo: OneOrMany<EventName>,
  eventName: string,
  callback: ListenerCallback<EventName>
) => {
  if (process.env.NODE_ENV === "test") return // don't register events in test mode

  if (typeof listeningTo === "string") listeningTo = [listeningTo]

  for (const singleEvent of listeningTo) {
    eventBus.on(singleEvent, async (data: EmittedData<EventName>) => {
      // first, log the event in the database
      const event_id = uuidv4()

      await db
        .insertInto("Events")
        .values({
          event_id,
          event_name: `${eventName} on ${singleEvent}`,
          payload: JSON.stringify(data.payload),
          origin_request_id: data.req.digest_id,
          created_at: new Date(),
          updated_at: new Date(),
          attempts: 0,
          initiator_event_id: data.event_id,
          initiator_event_name: singleEvent,
          next_attempt_at: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes from now
          status: "processing",
          origin_request_user_session: JSON.stringify(data.req.user),
          payload_version: data.payload_version,
        })
        .execute()

      const start = Date.now()

      try {
        const { req, res } = prepareReqRes(data)

        const eventResult = await callback(data, req, res)

        const event = await db
          .selectFrom("Events")
          .selectAll()
          .where("event_id", "=", event_id)
          .executeTakeFirstOrThrow()

        // log event completion
        await db
          .updateTable("Events")
          .set({
            status: "success",
            last_attempt_at: new Date(),
            attempts: event.attempts + 1,
            next_attempt_at: null,
            error_message: null,
            updated_at: new Date(),
            duration_ms: Date.now() - start,
            result_message: eventResult ? eventResult : null,
          })
          .where("event_id", "=", event_id)
          .execute()
      } catch (error: any) {
        // log that the event failed
        const event = await db
          .selectFrom("Events")
          .selectAll()
          .where("event_id", "=", event_id)
          .executeTakeFirstOrThrow()

        // calculate next attempt as exponential backoff
        const nextAttempt = Math.min((event.attempts + 1) * 1000 * 60, 1000 * 60 * 60) // max 1 hour
        const nextAttemptAt = new Date(Date.now() + nextAttempt)

        await db
          .updateTable("Events")
          .set({
            status: "failed",
            last_attempt_at: new Date(),
            attempts: event.attempts + 1,
            next_attempt_at: nextAttemptAt,
            error_message: JSON.stringify(error),
            updated_at: new Date(),
            duration_ms: Date.now() - start,
          })
          .where("event_id", "=", event_id)
          .execute()

        console.log("Event failed", {
          event_id,
          event_name: eventName,
          error: error,
        })
      }
    })
  }
}
