import { Hono } from "hono"
import { handle } from "hono/vercel"
import { app } from "@api/app"

export const runtime = "nodejs"
export const maxDuration = 60

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
