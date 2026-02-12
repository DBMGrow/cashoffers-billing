import { Hono } from "hono"
import { handle } from "hono/vercel"

export const runtime = "nodejs"
export const maxDuration = 60

const app = new Hono().basePath("/api")

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
