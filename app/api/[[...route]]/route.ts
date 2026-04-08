import { handle } from "hono/vercel"
import type { Hono } from "hono"
import type { HonoVariables } from "@api/types/hono"

export const runtime = "nodejs"
export const maxDuration = 60

// Lazy-load the API app to prevent eager loading of entire dependency tree
let appPromise: Promise<Hono<{ Variables: HonoVariables }>> | null = null

const getApp = async () => {
  if (!appPromise) {
    appPromise = import("@api/app").then((mod) => mod.app)
  }
  return appPromise
}

export const GET = async (request: Request) => {
  const app = await getApp()
  return handle(app)(request)
}

export const POST = async (request: Request) => {
  const app = await getApp()
  return handle(app)(request)
}

export const PUT = async (request: Request) => {
  const app = await getApp()
  return handle(app)(request)
}

export const DELETE = async (request: Request) => {
  const app = await getApp()
  return handle(app)(request)
}

export const PATCH = async (request: Request) => {
  const app = await getApp()
  return handle(app)(request)
}
