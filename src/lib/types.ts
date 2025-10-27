import { Request, Response, CookieOptions as CO, NextFunction as NF } from "express"
import { z } from "zod"
import { db } from "@/lib/database"
import { Express } from "express"
import { DB } from "@/lib/db"

export interface LogConfig {
  table_id?: number
  tablename?: keyof DB
  level?: string
}

export interface PagesResponse {
  page: number
  limit: number
  count: number
}

export interface Whitelabel {
  id: number
  logoText: string
}

export type LogMessage = string | object | null | undefined

export interface ValidateSchemaOptions {
  safeParse?: boolean
}

export interface Req extends Request {
  json(arg0: { success: boolean }): unknown
  user?: Session
  caps?: string[]
  digest_id: string
  getSession: () => Promise<Session>
  setSystemSession: () => Promise<void>
  getWhitelabel: () => Promise<Whitelabel>
  userCan: (...capabilities: string[]) => Promise<boolean>
  validateSchema: <T extends z.ZodType<any, any>>(schema: T, data: any, options?: ValidateSchemaOptions) => z.infer<T>
}
export type PromiseType<T extends Promise<any>> = T extends Promise<infer U> ? U : never

export interface Res extends Response {
  success: <T>(data: T, message?: string, pages?: PagesResponse, flattenBody?: boolean) => void
  warnings?: string[]
  warn: (message: string) => void
  notes?: string[]
  info: (message: string) => void
  addSession: (user: Session) => Promise<void>
  removeSession: () => void
  onFinish: (name: string, callback: () => Promise<void>) => Promise<void>
  log: (...args: [...message: LogMessage[], config: LogConfig]) => void
  _finishCallbacks: {
    cb: () => Promise<void>
    name: string
  }[]
  error: (error: Error) => void
  _finished: boolean
}
export interface CookieOptions extends CO {}
export interface NextFunction extends NF {}

export interface Session {
  user_id: number
  created: Date
  role: string
  team_id: number | null
  email: string
  password: string
  name: string | null
  phone: string | null
  name_broker: string | null
  name_team: string | null
  agent_user_id: number | null
  lender_user_id: number | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  api_token: string | null
  active: number
  reset_token: string | null
  reset_created: Date | null
  whitelabel_id: number
  notifications_email: number
  notifications_sms: number
  notifications_email_allproperties: number
  notifications_email_alloffers_accept: number
  investor_view_address: number
  is_premium: number | null
  card_id: string | null
  showings_info_read: number
}

const user = db.selectFrom("Users").selectAll().executeTakeFirst()
export type UserType = NonNullable<PromiseType<typeof user>>

const website = db.selectFrom("Websites").selectAll().executeTakeFirst()
export type Websites = NonNullable<PromiseType<typeof website>>

const capabilities = db.selectFrom("Roles").selectAll().executeTakeFirst()
export type Caps = NonNullable<PromiseType<typeof capabilities>>

export interface WebsiteType {
  user_id: number
  active: number
  about: string
  code_conversion: string
  code_tracking: string
  color_scheme: "B&W" | "BLUE" | "HIGHESTPRICE" | "RED" | null
  domain: string
  logo_url?: string | null
  footer: string
  phone: string
  slug: string
  testimonials: string
  title: string
  created?: Date
}
