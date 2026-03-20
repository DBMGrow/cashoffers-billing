/**
 * Developer Tooling Routes
 *
 * These endpoints exist ONLY in non-production environments.
 * They are designed to make manual testing of every system lifecycle
 * as easy as possible — no manual DB edits, no curl gymnastics.
 *
 * Endpoints:
 *   GET  /dev/system                         — Quick overview of system state
 *   GET  /dev/state/:user_id                 — Full state dump for one user
 *   POST /dev/scenarios                      — Create named test scenarios
 *   POST /dev/subscription/:id/set-state     — Patch any subscription fields
 *   GET  /dev/cron/preview                   — What would cron do right now?
 *   POST /dev/cron/run-for-user/:user_id     — Run renewal for one user only
 *   POST /dev/webhook/cashoffers             — Fire a signed webhook event
 *   DELETE /dev/cleanup/:user_id             — Remove user and all related data
 */

import { createHmac } from "crypto"
import { Hono } from "hono"
import { z } from "zod"
import type { HonoVariables } from "@api/types/hono"
import { db } from "@api/lib/database"
import { config } from "@api/config/config.service"
import {
  subscriptionRepository,
  productRepository,
  transactionRepository,
} from "@api/lib/repositories"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"
import { logger, userApiClient, eventBus } from "@api/lib/services"
import { CashOffersWebhookHandler } from "@api/application/webhook-handlers/cashoffers-webhook.handler"

const app = new Hono<{ Variables: HonoVariables }>()

// ─── Guard: non-production only ──────────────────────────────────────────────

if (config.nodeEnv === "production") {
  app.all("/*", (c) =>
    c.json({ success: "error" as const, error: "Dev endpoints disabled in production" }, 404)
  )
  console.warn("⛔  Dev routes disabled (production environment)")
} else {
  console.log("🔧  Dev tooling endpoints enabled")
  registerDevRoutes(app)
}

function registerDevRoutes(router: Hono<{ Variables: HonoVariables }>) {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatAmount(cents: number | null): string {
    if (cents == null) return "—"
    return `$${(cents / 100).toFixed(2)}`
  }

  function daysFromNow(date: Date | null): string {
    if (!date) return "—"
    const diff = Math.round((date.getTime() - Date.now()) / 86_400_000)
    if (diff === 0) return "today"
    if (diff > 0) return `in ${diff}d`
    return `${Math.abs(diff)}d ago`
  }

  function generateRandomEmail(prefix: string): string {
    return `${prefix}-${Date.now()}@dev-test.local`
  }

  // ── Shared webhook handler instance ──────────────────────────────────────

  const webhookHandler = new CashOffersWebhookHandler({
    logger,
    userApiClient,
    subscriptionRepository,
    productRepository,
    transactionRepository,
    eventBus,
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/system — System overview
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/system", async (c) => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86_400_000)
    const tenDaysFromNow = new Date(now.getTime() + 10 * 86_400_000)

    const [
      subscriptionCounts,
      overdueRenewals,
      expiredTrials,
      expiringTrials,
      recentFailedTx,
      recentWebhooks,
    ] = await Promise.all([
      // Count subscriptions by status
      db.selectFrom("Subscriptions")
        .select(["status", db.fn.count<number>("subscription_id").as("count")])
        .groupBy("status")
        .execute(),

      // Active subscriptions with renewal_date in the past (overdue)
      db.selectFrom("Subscriptions")
        .where("status", "=", "active")
        .where("renewal_date", "<=", now)
        .select(["subscription_id", "user_id", "subscription_name", "amount", "renewal_date",
                 "cancel_on_renewal", "downgrade_on_renewal", "next_renewal_attempt"])
        .orderBy("renewal_date", "asc")
        .limit(20)
        .execute(),

      // Expired trials
      db.selectFrom("Subscriptions")
        .where("status", "=", "trial")
        .where("renewal_date", "<=", now)
        .select(["subscription_id", "user_id", "subscription_name", "renewal_date"])
        .limit(20)
        .execute(),

      // Trials expiring in next 10 days
      db.selectFrom("Subscriptions")
        .where("status", "=", "trial")
        .where("renewal_date", ">", now)
        .where("renewal_date", "<=", tenDaysFromNow)
        .select(["subscription_id", "user_id", "subscription_name", "renewal_date"])
        .orderBy("renewal_date", "asc")
        .limit(20)
        .execute(),

      // Failed transactions in last 24h
      db.selectFrom("Transactions")
        .where("status", "=", "failed")
        .where("createdAt", ">=", yesterday)
        .select(["transaction_id", "user_id", "amount", "memo", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(20)
        .execute(),

      // Recent webhook events
      db.selectFrom("Transactions")
        .where("type", "=", "webhook")
        .select(["transaction_id", "user_id", "memo", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(10)
        .execute(),
    ])

    // Annotate overdue renewals with what cron will do
    const annotatedOverdue = overdueRenewals.map((sub) => ({
      subscription_id: sub.subscription_id,
      user_id: sub.user_id,
      name: sub.subscription_name,
      amount: formatAmount(sub.amount),
      renewal_date: sub.renewal_date,
      overdue_by: daysFromNow(sub.renewal_date),
      next_renewal_attempt: sub.next_renewal_attempt,
      flags: [
        sub.cancel_on_renewal ? "cancel_on_renewal" : null,
        sub.downgrade_on_renewal ? "downgrade_on_renewal" : null,
      ].filter(Boolean),
      cron_will: sub.cancel_on_renewal
        ? "CANCEL (not charge)"
        : sub.downgrade_on_renewal
        ? "SKIP (downgrade pending)"
        : "CHARGE",
    }))

    return c.json({
      success: "success",
      data: {
        snapshot_at: now.toISOString(),
        subscriptions_by_status: Object.fromEntries(
          subscriptionCounts.map((r) => [r.status ?? "null", Number(r.count)])
        ),
        overdue_renewals: {
          count: overdueRenewals.length,
          items: annotatedOverdue,
        },
        trials: {
          expired: { count: expiredTrials.length, items: expiredTrials },
          expiring_in_10d: { count: expiringTrials.length, items: expiringTrials },
        },
        recent_failures_24h: {
          count: recentFailedTx.length,
          items: recentFailedTx.map((t) => ({
            ...t,
            amount: formatAmount(t.amount),
          })),
        },
        recent_webhooks: recentWebhooks,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/state/:user_id — Full user state dump
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/state/:user_id", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["user_id", "email", "name", "role", "is_premium", "active", "whitelabel_id", "created"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    const [subscriptions, card, transactions, billingLogs] = await Promise.all([
      // All subscriptions with product name
      db.selectFrom("Subscriptions")
        .leftJoin("Products", "Products.product_id", "Subscriptions.product_id")
        .where("Subscriptions.user_id", "=", userId)
        .select([
          "Subscriptions.subscription_id",
          "Subscriptions.subscription_name",
          "Subscriptions.status",
          "Subscriptions.amount",
          "Subscriptions.duration",
          "Subscriptions.renewal_date",
          "Subscriptions.next_renewal_attempt",
          "Subscriptions.cancel_on_renewal",
          "Subscriptions.downgrade_on_renewal",
          "Subscriptions.suspension_date",
          "Subscriptions.square_environment",
          "Subscriptions.data",
          "Subscriptions.createdAt",
          "Subscriptions.updatedAt",
          "Products.product_name",
        ])
        .orderBy("Subscriptions.createdAt", "desc")
        .execute(),

      // Payment card
      db.selectFrom("UserCards")
        .where("user_id", "=", userId)
        .select(["card_brand", "last_4", "exp_month", "exp_year", "cardholder_name",
                 "square_environment", "createdAt"])
        .executeTakeFirst(),

      // Last 25 transactions
      db.selectFrom("Transactions")
        .where("user_id", "=", userId)
        .select(["transaction_id", "type", "amount", "status", "memo",
                 "square_transaction_id", "square_environment", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(25)
        .execute(),

      // Last 25 billing logs (gracefully handle if column doesn't exist)
      db.selectFrom("BillingLogs")
        .where("user_id", "=", userId)
        .select(["log_id", "level", "component", "message", "metadata", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(25)
        .execute()
        .catch(() => [] as any[]),
    ])

    const annotatedSubs = subscriptions.map((sub) => ({
      ...sub,
      amount_formatted: formatAmount(sub.amount),
      renewal_in: daysFromNow(sub.renewal_date),
      flags: [
        sub.cancel_on_renewal ? "cancel_on_renewal" : null,
        sub.downgrade_on_renewal ? "downgrade_on_renewal" : null,
        sub.suspension_date ? "suspended" : null,
      ].filter(Boolean),
    }))

    return c.json({
      success: "success",
      data: {
        user: {
          ...user,
          is_premium: Boolean(user.is_premium),
          active: Boolean(user.active),
        },
        card: card
          ? {
              ...card,
              display: `${card.card_brand} •••• ${card.last_4} (exp ${card.exp_month}/${card.exp_year})`,
              environment: card.square_environment,
            }
          : null,
        subscriptions: annotatedSubs,
        transactions: transactions.map((t) => ({
          ...t,
          amount_formatted: formatAmount(t.amount),
        })),
        billing_logs: billingLogs,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/scenarios — Create named test scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  const ScenarioSchema = z.object({
    scenario: z.enum([
      "renewal-due",
      "payment-retry-1",
      "payment-retry-2",
      "trial-expiring",
      "trial-expired",
      "cancel-on-renewal",
      "downgrade-on-renewal",
      "paused",
    ]),
    email: z.string().email().optional(),
    name: z.string().optional(),
    product_id: z.number().optional(),
  })

  router.post("/scenarios", async (c) => {
    const rawBody = await c.req.json().catch(() => null)
    const parsed = ScenarioSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: parsed.error.message }, 400)
    }
    const { scenario, email, name, product_id } = parsed.data

    // Resolve product
    let resolvedProductId = product_id
    if (!resolvedProductId) {
      const anyProduct = await db
        .selectFrom("Products")
        .select("product_id")
        .where("product_type", "=", "subscription")
        .limit(1)
        .executeTakeFirst()
      if (anyProduct) resolvedProductId = anyProduct.product_id
    }

    const resolvedEmail = email ?? generateRandomEmail(scenario)
    const resolvedName = name ?? `Dev Test [${scenario}]`
    const now = new Date()

    // Create user
    const userResult = await db
      .insertInto("Users")
      .values({
        email: resolvedEmail,
        name: resolvedName,
        role: "AGENT",
        whitelabel_id: 1,
        is_premium: 1,
        active: 1,
        api_token: null,
      })
      .executeTakeFirstOrThrow()

    const userId = Number(userResult.insertId)

    interface ScenarioConfig {
      status: "active" | "trial" | "paused" | "cancelled"
      renewal_date: Date
      next_renewal_attempt: Date | null
      cancel_on_renewal: number
      downgrade_on_renewal: number
      suspension_date: Date | null
      description: string
      next_steps: string
    }

    const scenarioConfigs: Record<string, ScenarioConfig> = {
      "renewal-due": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Active subscription with renewal_date 2 hours in the past.",
        next_steps: "Run POST /api/cron/run (with CRON_SECRET) or POST /api/dev/cron/run-for-user/:user_id to trigger renewal charge.",
      },
      "payment-retry-1": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 86_400_000),
        next_renewal_attempt: new Date(now.getTime() - 3600_000),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Subscription that failed payment once. next_renewal_attempt is past due — cron will retry.",
        next_steps: "Run POST /api/dev/cron/run-for-user/:user_id to trigger the retry.",
      },
      "payment-retry-2": {
        status: "active",
        renewal_date: new Date(now.getTime() - 5 * 86_400_000),
        next_renewal_attempt: new Date(now.getTime() - 3600_000),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Subscription that failed payment twice. Simulating second retry window.",
        next_steps: "Run POST /api/dev/cron/run-for-user/:user_id to trigger the retry.",
      },
      "trial-expiring": {
        status: "trial",
        renewal_date: new Date(now.getTime() + 9 * 86_400_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Trial subscription expiring in 9 days (within the 10-day warning window).",
        next_steps: "Run POST /api/cron/run to trigger the trial-warning email flow.",
      },
      "trial-expired": {
        status: "trial",
        renewal_date: new Date(now.getTime() - 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Trial subscription that has already passed its expiry date.",
        next_steps: "Run POST /api/cron/run to trigger trial expiration: status → cancelled, event published, email sent.",
      },
      "cancel-on-renewal": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 1,
        downgrade_on_renewal: 0,
        suspension_date: null,
        description: "Active subscription with cancel_on_renewal=true and past renewal_date.",
        next_steps: "Run cron: subscription will be CANCELLED (not charged). Verify status becomes 'cancelled'.",
      },
      "downgrade-on-renewal": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 1,
        suspension_date: null,
        description: "Active subscription with downgrade_on_renewal=true and past renewal_date.",
        next_steps: "Run cron: subscription will be SKIPPED. Verify cron logs 'skipping downgrade'.",
      },
      "paused": {
        status: "paused",
        renewal_date: new Date(now.getTime() + 30 * 86_400_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: now,
        description: "Subscription in paused state. Not picked up by cron.",
        next_steps: "Call POST /api/subscription/resume/:id to resume it (recalculates renewal_date based on time paused).",
      },
    }

    const cfg = scenarioConfigs[scenario]

    const subResult = await db
      .insertInto("Subscriptions")
      .values({
        user_id: userId,
        product_id: resolvedProductId ?? null,
        subscription_name: `[DEV] ${scenario}`,
        amount: 25000,
        status: cfg.status,
        duration: "monthly",
        renewal_date: cfg.renewal_date,
        next_renewal_attempt: cfg.next_renewal_attempt,
        cancel_on_renewal: cfg.cancel_on_renewal,
        downgrade_on_renewal: cfg.downgrade_on_renewal,
        suspension_date: cfg.suspension_date,
        square_environment: "sandbox",
        createdAt: now,
        updatedAt: now,
      })
      .executeTakeFirstOrThrow()

    const subscriptionId = Number(subResult.insertId)

    return c.json({
      success: "success",
      data: {
        scenario,
        user_id: userId,
        email: resolvedEmail,
        subscription_id: subscriptionId,
        description: cfg.description,
        next_steps: cfg.next_steps,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/subscription/:id/set-state — Directly mutate subscription state
  // ═══════════════════════════════════════════════════════════════════════════

  const SetStateSchema = z.object({
    renewal_date: z.string().datetime().optional(),
    next_renewal_attempt: z.string().datetime().nullable().optional(),
    cancel_on_renewal: z.boolean().optional(),
    downgrade_on_renewal: z.boolean().optional(),
    status: z.enum(["active", "trial", "paused", "cancelled", "inactive"]).optional(),
    suspension_date: z.string().datetime().nullable().optional(),
    square_environment: z.enum(["production", "sandbox"]).optional(),
    amount: z.number().int().positive().optional(),
  })

  router.post("/subscription/:id/set-state", async (c) => {
    const id = parseInt(c.req.param("id"), 10)
    const rawBody = await c.req.json().catch(() => null)
    const parsed = SetStateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: parsed.error.message }, 400)
    }
    const body = parsed.data

    const existing = await subscriptionRepository.findById(id)
    if (!existing) {
      return c.json({ success: "error", error: `Subscription ${id} not found` }, 404)
    }

    const patch: Record<string, any> = { updatedAt: new Date() }
    if (body.renewal_date != null) patch.renewal_date = new Date(body.renewal_date)
    if ("next_renewal_attempt" in body) {
      patch.next_renewal_attempt = body.next_renewal_attempt ? new Date(body.next_renewal_attempt) : null
    }
    if (body.cancel_on_renewal != null) patch.cancel_on_renewal = body.cancel_on_renewal ? 1 : 0
    if (body.downgrade_on_renewal != null) patch.downgrade_on_renewal = body.downgrade_on_renewal ? 1 : 0
    if (body.status != null) patch.status = body.status
    if ("suspension_date" in body) {
      patch.suspension_date = body.suspension_date ? new Date(body.suspension_date) : null
    }
    if (body.square_environment != null) patch.square_environment = body.square_environment
    if (body.amount != null) patch.amount = body.amount

    const updated = await subscriptionRepository.update(id, patch)

    return c.json({
      success: "success",
      data: {
        ...updated,
        renewal_in: daysFromNow(updated.renewal_date),
        amount_formatted: formatAmount(updated.amount),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/cron/preview — What would cron do right now?
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/cron/preview", async (c) => {
    const now = new Date()
    const tenDaysFromNow = new Date(now.getTime() + 10 * 86_400_000)

    // Replicate the exact query from subscriptionsCron.findSubscriptionsForCronProcessing
    const [dueSubscriptions, expiredTrials, expiringTrials] = await Promise.all([
      db.selectFrom("Subscriptions")
        .leftJoin("Products", "Products.product_id", "Subscriptions.product_id")
        .where("Subscriptions.status", "=", "active")
        .where((eb) =>
          eb.or([
            eb("Subscriptions.next_renewal_attempt", "is", null),
            eb("Subscriptions.next_renewal_attempt", "<=", now),
          ])
        )
        .where((eb) =>
          eb.or([
            eb("Subscriptions.renewal_date", "is", null),
            eb("Subscriptions.renewal_date", "<=", now),
          ])
        )
        .select([
          "Subscriptions.subscription_id",
          "Subscriptions.user_id",
          "Subscriptions.subscription_name",
          "Subscriptions.amount",
          "Subscriptions.renewal_date",
          "Subscriptions.next_renewal_attempt",
          "Subscriptions.cancel_on_renewal",
          "Subscriptions.downgrade_on_renewal",
          "Subscriptions.square_environment",
          "Products.product_name",
        ])
        .orderBy("Subscriptions.renewal_date", "asc")
        .execute(),

      db.selectFrom("Subscriptions")
        .where("status", "=", "trial")
        .where("renewal_date", "<=", now)
        .select(["subscription_id", "user_id", "subscription_name", "renewal_date"])
        .execute(),

      db.selectFrom("Subscriptions")
        .where("status", "=", "trial")
        .where("renewal_date", ">", now)
        .where("renewal_date", "<=", tenDaysFromNow)
        .select(["subscription_id", "user_id", "subscription_name", "renewal_date"])
        .orderBy("renewal_date", "asc")
        .execute(),
    ])

    const renewalActions = dueSubscriptions.map((sub) => {
      const action = sub.cancel_on_renewal
        ? "CANCEL"
        : sub.downgrade_on_renewal
        ? "SKIP"
        : "CHARGE"

      const reason = sub.cancel_on_renewal
        ? "cancel_on_renewal flag is set"
        : sub.downgrade_on_renewal
        ? "downgrade_on_renewal flag is set (downgrade logic pending)"
        : `Will attempt ${formatAmount(sub.amount)} via Square ${sub.square_environment ?? "production"}`

      return {
        subscription_id: sub.subscription_id,
        user_id: sub.user_id,
        name: sub.subscription_name,
        product: sub.product_name ?? "(no product)",
        amount_formatted: formatAmount(sub.amount),
        renewal_date: sub.renewal_date,
        overdue_by: daysFromNow(sub.renewal_date),
        next_renewal_attempt: sub.next_renewal_attempt,
        square_environment: sub.square_environment,
        action,
        reason,
        note: "User activity not checked here — inactive users are skipped at cron runtime",
      }
    })

    return c.json({
      success: "success",
      data: {
        preview_at: now.toISOString(),
        summary: {
          total_due: dueSubscriptions.length,
          will_charge: renewalActions.filter((a) => a.action === "CHARGE").length,
          will_cancel: renewalActions.filter((a) => a.action === "CANCEL").length,
          will_skip: renewalActions.filter((a) => a.action === "SKIP").length,
          trials_to_expire: expiredTrials.length,
          trials_warning_email: expiringTrials.length,
        },
        renewals: renewalActions,
        trial_expirations: expiredTrials.map((t) => ({
          ...t,
          action: "EXPIRE → status=cancelled + email",
        })),
        trial_warnings: expiringTrials.map((t) => ({
          ...t,
          days_remaining: Math.ceil((t.renewal_date.getTime() - now.getTime()) / 86_400_000),
          action: "SEND trial-expiring email",
        })),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/cron/run-for-user/:user_id — Run renewal for one user
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/cron/run-for-user/:user_id", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)
    const rawBody = await c.req.json().catch(() => ({}))
    const email: string | undefined = rawBody?.email

    // Find the user's active subscription
    const activeSubs = await subscriptionRepository.findActiveByUserId(userId)
    if (activeSubs.length === 0) {
      return c.json({ success: "error", error: `No active subscription found for user ${userId}` }, 404)
    }

    const sub = activeSubs.find((s) => s.status === "active") ?? activeSubs[0]

    // Get email from DB or use override
    let resolvedEmail = email
    if (!resolvedEmail) {
      const user = await db
        .selectFrom("Users")
        .where("user_id", "=", userId)
        .select("email")
        .executeTakeFirst()
      if (!user) {
        return c.json({ success: "error", error: `User ${userId} not found` }, 404)
      }
      resolvedEmail = user.email
    }

    logger.info("[DEV] Running renewal for single user", {
      userId,
      subscriptionId: sub.subscription_id,
      email: resolvedEmail,
    })

    const result = await renewSubscriptionUseCase.execute({
      subscriptionId: sub.subscription_id,
      email: resolvedEmail,
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: result.error ?? "Renewal failed",
        data: {
          subscription_id: sub.subscription_id,
          user_id: userId,
          email: resolvedEmail,
          hint: "Check GET /api/dev/state/:user_id to see updated subscription state and transaction log.",
        },
      }, 400)
    }

    return c.json({
      success: "success",
      data: {
        subscription_id: sub.subscription_id,
        user_id: userId,
        email: resolvedEmail,
        result: result.data,
        hint: "Check GET /api/dev/state/:user_id to see updated renewal_date and new transaction.",
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/webhook/cashoffers — Fire a signed webhook event
  // ═══════════════════════════════════════════════════════════════════════════

  const WebhookSchema = z.object({
    type: z.enum(["user.deactivated", "user.activated", "user.created"]),
    userId: z.number().int().positive(),
  })

  router.post("/webhook/cashoffers", async (c) => {
    const rawBody = await c.req.json().catch(() => null)
    const parsed = WebhookSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: parsed.error.message }, 400)
    }
    const body = parsed.data

    const bodyStr = JSON.stringify(body)
    const signature = config.webhookSecret
      ? createHmac("sha256", config.webhookSecret).update(bodyStr).digest("hex")
      : null

    // Verify the user exists locally
    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", body.userId)
      .select(["user_id", "email", "name", "active"])
      .executeTakeFirst()

    if (!user) {
      return c.json({
        success: "error",
        error: `User ${body.userId} not found. Create them first via POST /api/dev/scenarios or POST /api/test/create-user.`,
      }, 400)
    }

    // Snapshot subscriptions before
    const subsBefore = await subscriptionRepository.findByUserId(body.userId)

    // Run through the real webhook handler (same code path as production)
    try {
      await webhookHandler.handle(body)
    } catch (err: any) {
      return c.json({
        success: "error",
        error: `Webhook handler threw: ${err?.message ?? String(err)}`,
      }, 400)
    }

    // Snapshot subscriptions after
    const subsAfter = await subscriptionRepository.findByUserId(body.userId)

    const changes = subsAfter.reduce<{ subscription_id: number; status: string }[]>((acc, after) => {
      const before = subsBefore.find((b) => b.subscription_id === after.subscription_id)
      if (before && before.status !== after.status) {
        acc.push({ subscription_id: after.subscription_id, status: `${before.status} → ${after.status}` })
      }
      return acc
    }, [])

    return c.json({
      success: "success",
      data: {
        event: body,
        user: { user_id: user.user_id, email: user.email, name: user.name },
        signature_header: signature
          ? `X-Webhook-Signature: ${signature}`
          : "No CASHOFFERS_WEBHOOK_SECRET configured (open mode — signature not required)",
        subscriptions_before: subsBefore.map((s) => ({
          id: s.subscription_id,
          status: s.status,
          renewal_date: s.renewal_date,
        })),
        subscriptions_after: subsAfter.map((s) => ({
          id: s.subscription_id,
          status: s.status,
          renewal_date: s.renewal_date,
        })),
        changes,
        hint: "Use GET /api/dev/state/:user_id to see the full updated state.",
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // DELETE /dev/cleanup/:user_id — Remove user and all related data
  // ═══════════════════════════════════════════════════════════════════════════

  router.delete("/cleanup/:user_id", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["user_id", "email"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    const [txDel, subDel, cardDel] = await Promise.all([
      db.deleteFrom("Transactions").where("user_id", "=", userId).execute(),
      db.deleteFrom("Subscriptions").where("user_id", "=", userId).execute(),
      db.deleteFrom("UserCards").where("user_id", "=", userId).execute(),
    ])

    await db.deleteFrom("Users").where("user_id", "=", userId).execute()

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        email: user.email,
        deleted: {
          transactions: Number(txDel[0]?.numDeletedRows ?? 0),
          subscriptions: Number(subDel[0]?.numDeletedRows ?? 0),
          cards: Number(cardDel[0]?.numDeletedRows ?? 0),
        },
      },
    })
  })
}

export const devRoutes = app
