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
 *   POST /dev/card/:user_id/break           — Replace card with invalid one (forces payment failures)
 *   POST /dev/card/:user_id/fix             — Restore card with valid sandbox card
 *   POST /dev/user/:user_id/set-password    — Set password for a user (for testing manage flows)
 *   POST /dev/refund/:user_id               — Refund the most recent payment (or specific transaction)
 *   POST /dev/property-unlock/:property_token — Test property unlock flow ($50 sandbox charge)
 */

import { createHmac } from "crypto"
import { Hono } from "hono"
import { z } from "zod"
import bcrypt from "bcrypt"
import type { HonoVariables } from "@api/types/hono"
import { db } from "@api/lib/database"
import { config } from "@api/config/config.service"
import {
  subscriptionRepository,
  productRepository,
  transactionRepository,
} from "@api/lib/repositories"
import { renewSubscriptionUseCase } from "@api/use-cases/subscription"
import { logger, userApiClient, eventBus, paymentProvider } from "@api/lib/services"
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

  // ── Sensitive-data redaction ─────────────────────────────────────────────
  //
  // Masks values whose key name looks like a credential, token, card number,
  // signature, or other secret. Applied recursively, including inside JSON
  // strings so that serialized metadata blobs are also scrubbed before leaving
  // the server. Err on the side of over-redacting: these endpoints exist for
  // debugging and must never leak raw credentials into logs or terminals.
  const SENSITIVE_KEY_REGEX = /(^|[_\-.])(password|passwd|pwd|secret|token|api[_\-]?key|apikey|authorization|bearer|private[_\-]?key|privkey|access[_\-]?token|refresh[_\-]?token|id[_\-]?token|jwt|cookie|session[_\-]?id|client[_\-]?secret|encryption[_\-]?key|signature|hash|credential|cvv|cvc|card[_\-]?number|pan|account[_\-]?number|routing[_\-]?number|ssn)([_\-.]|$)/i

  function shouldRedactKey(key: string): boolean {
    return SENSITIVE_KEY_REGEX.test(key)
  }

  function redactSensitive(value: unknown): unknown {
    if (value == null) return value
    if (typeof value === "string") {
      // Try to parse strings that look like JSON so nested secrets get redacted too.
      const trimmed = value.trim()
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          const parsed = JSON.parse(trimmed)
          return redactSensitive(parsed)
        } catch {
          return value
        }
      }
      return value
    }
    if (Array.isArray(value)) {
      return value.map(redactSensitive)
    }
    if (typeof value === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (shouldRedactKey(k)) {
          out[k] = "[REDACTED]"
        } else {
          out[k] = redactSensitive(v)
        }
      }
      return out
    }
    return value
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
          "Subscriptions.payment_failure_count",
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
      payment_failure_count: sub.payment_failure_count ?? 0,
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
      "payment-failure",
      "payment-retry-1",
      "payment-retry-2",
      "payment-retry-3",
      "trial-expiring",
      "trial-expired",
      "cancel-on-renewal",
      "downgrade-on-renewal",
      "paused",
      "suspended",
      "premium-no-sub",
    ]),
    email: z.string().email().optional(),
    name: z.string().optional(),
    product_id: z.number().optional(),
    product: z.enum(["p-co", "p-hu", "p-trial"]).optional(),
  })

  router.post("/scenarios", async (c) => {
    const rawBody = await c.req.json().catch(() => null)
    const parsed = ScenarioSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: parsed.error.message }, 400)
    }
    const { scenario, email, name, product_id, product: productType = "p-co" } = parsed.data

    // Resolve product — prefer one matching the product type's category
    const productCategoryMap = {
      "p-co": "premium_cashoffers",
      "p-hu": "external_cashoffers",
      "p-trial": "homeuptick_only",
    } as const

    let resolvedProductId = product_id
    if (!resolvedProductId) {
      const matchingProduct = await db
        .selectFrom("Products")
        .select("product_id")
        .where("product_type", "=", "subscription")
        .where("product_category", "=", productCategoryMap[productType])
        .limit(1)
        .executeTakeFirst()
      if (matchingProduct) {
        resolvedProductId = matchingProduct.product_id
      } else {
        // Fall back to any subscription product
        const anyProduct = await db
          .selectFrom("Products")
          .select("product_id")
          .where("product_type", "=", "subscription")
          .limit(1)
          .executeTakeFirst()
        if (anyProduct) resolvedProductId = anyProduct.product_id
      }
    }

    const resolvedEmail = email ?? generateRandomEmail(scenario)
    const resolvedName = name ?? `Dev Test [${scenario}]`
    const now = new Date()

    interface ScenarioConfig {
      status: "active" | "trial" | "paused" | "cancelled" | "suspended"
      renewal_date: Date
      next_renewal_attempt: Date | null
      cancel_on_renewal: number
      downgrade_on_renewal: number
      suspension_date: Date | null
      payment_failure_count: number
      broken_card: boolean
      description: string
      next_steps: string
      whitelabel_id?: number
    }

    const scenarioConfigs: Record<string, ScenarioConfig> = {
      "renewal-due": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 0,
        broken_card: false,
        description: "Active subscription with renewal_date 2 hours in the past.",
        next_steps: "Run POST /api/cron/run (with CRON_SECRET) or POST /api/dev/cron/run-for-user/:user_id to trigger renewal charge.",
      },
      "payment-failure": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 0,
        broken_card: true,
        description: "Active subscription overdue for renewal with an INVALID card on file. Running cron will trigger a real payment failure → retry scheduling → failure email.",
        next_steps: "Run: yarn dev:tools cron-run <user_id>. Payment will fail, next_renewal_attempt will be set to +1 day, and a PaymentFailed event fires.",
      },
      "payment-retry-1": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 86_400_000),
        next_renewal_attempt: new Date(now.getTime() - 3600_000),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 1,
        broken_card: false,
        description: "Subscription that failed payment once (payment_failure_count=1). next_renewal_attempt is past due. Valid card — run break-card then cron-run to simulate second failure, or cron-run directly to succeed.",
        next_steps: "Run: yarn dev:tools break-card <user_id> then yarn dev:tools cron-run <user_id> to trigger 2nd failure (+3d retry), or cron-run directly to succeed and reset count.",
      },
      "payment-retry-2": {
        status: "active",
        renewal_date: new Date(now.getTime() - 5 * 86_400_000),
        next_renewal_attempt: new Date(now.getTime() - 3600_000),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 2,
        broken_card: false,
        description: "Subscription that failed payment twice (payment_failure_count=2). Simulating second retry window.",
        next_steps: "Run: yarn dev:tools break-card <user_id> then yarn dev:tools cron-run <user_id> to trigger 3rd failure (+7d retry).",
      },
      "payment-retry-3": {
        status: "active",
        renewal_date: new Date(now.getTime() - 12 * 86_400_000),
        next_renewal_attempt: new Date(now.getTime() - 3600_000),
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 3,
        broken_card: false,
        description: "Subscription that failed payment three times (payment_failure_count=3). Next failure triggers auto-suspension.",
        next_steps: "Run: yarn dev:tools break-card <user_id> then yarn dev:tools cron-run <user_id>. Subscription will be SUSPENDED (status → suspended, suspension_date set).",
      },
      "trial-expiring": {
        status: "trial",
        renewal_date: new Date(now.getTime() + 9 * 86_400_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 0,
        broken_card: false,
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
        payment_failure_count: 0,
        broken_card: false,
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
        payment_failure_count: 0,
        broken_card: false,
        description: "Active subscription with cancel_on_renewal=true and past renewal_date.",
        next_steps: "Run cron: subscription will be CANCELLED (not charged). Verify status becomes 'cancelled'.",
      },
      "downgrade-on-renewal": {
        status: "active",
        renewal_date: new Date(now.getTime() - 2 * 3600_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 1,
        downgrade_on_renewal: 0,
        suspension_date: null,
        payment_failure_count: 0,
        broken_card: false,
        whitelabel_id: 2,
        description: "Active subscription with cancel_on_renewal=true. User has whitelabel_id=2 (DOWNGRADE_TO_FREE). Cron processes cancellation; use case resolves suspension_behavior from white label and publishes SubscriptionCancelledEvent with suspensionStrategy=DOWNGRADE_TO_FREE.",
        next_steps: "Run cron: subscription status → cancelled. Handler reads suspensionStrategy=DOWNGRADE_TO_FREE and sets user is_premium=0 (not deactivated). Verify via: yarn dev:tools state <user_id>.",
      },
      "paused": {
        status: "paused",
        renewal_date: new Date(now.getTime() + 30 * 86_400_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: now,
        payment_failure_count: 0,
        broken_card: false,
        description: "Subscription in paused state (CO deactivated via webhook). Not picked up by cron.",
        next_steps: "Fire yarn dev:tools webhook user.activated <user_id> to resume (recalculates renewal_date based on time paused).",
      },
      "suspended": {
        status: "suspended",
        renewal_date: new Date(now.getTime() - 15 * 86_400_000),
        next_renewal_attempt: null,
        cancel_on_renewal: 0,
        downgrade_on_renewal: 0,
        suspension_date: new Date(now.getTime() - 2 * 86_400_000),
        payment_failure_count: 4,
        broken_card: true,
        description: "Subscription suspended after 4 payment failures (max retries exhausted). Card is INVALID. Card update triggers immediate payment attempt.",
        next_steps: "Run: yarn dev:tools fix-card <user_id> to simulate card update. On success, subscription reactivates. Verify via: yarn dev:tools state <user_id>.",
      },
    }

    // Special scenario: premium user with no billing subscription
    // Used to test the manage enrollment flow for external_cashoffers / premium_cashoffers
    if (scenario === "premium-no-sub") {
      const scenarioWhitelabelId = 1
      const userResult = await db
        .insertInto("Users")
        .values({
          email: resolvedEmail,
          name: resolvedName,
          role: "AGENT",
          whitelabel_id: scenarioWhitelabelId,
          is_premium: 1,
          active: 1,
          api_token: null,
        })
        .executeTakeFirstOrThrow()

      const userId = Number(userResult.insertId)

      // Set a password so the user can log in via /manage
      const bcryptHash = await (await import("bcrypt")).default.hash("test123", 10)
      await db.updateTable("Users").set({ password: bcryptHash }).where("user_id", "=", userId).execute()

      return c.json({
        success: "success",
        data: {
          scenario,
          product_type: "none",
          user_id: userId,
          email: resolvedEmail,
          subscription_id: null,
          card: null,
          password: "test123",
          description: "Premium user (is_premium=1, role=AGENT) with NO billing subscription. User can log in to /manage to test enrollment flow.",
          next_steps: [
            `yarn dev:tools auth-link ${userId}  → open in browser to test /manage enrollment`,
            `GET /manage/enrollment → should return external_cashoffers products`,
            `GET /manage/enrollment?category=premium_cashoffers → override to premium products`,
          ].join("\n"),
        },
      })
    }

    const cfg = scenarioConfigs[scenario]
    const scenarioWhitelabelId = cfg.whitelabel_id ?? 1

    // Product type determines CO managed flag, user role, is_premium, and product_category
    const productTypeConfig = {
      "p-co":    { managed: true,  role: "AGENT" as const, is_premium: 1, product_category: "premium_cashoffers" as const },
      "p-hu":    { managed: false, role: "AGENT" as const, is_premium: 0, product_category: "external_cashoffers" as const },
      "p-trial": { managed: true,  role: "HOMEUPTICK" as const, is_premium: 0, product_category: "homeuptick_only" as const },
    }[productType]

    // Create user (whitelabel_id and role vary per scenario/product type)
    const userResult = await db
      .insertInto("Users")
      .values({
        email: resolvedEmail,
        name: resolvedName,
        role: productTypeConfig.role,
        whitelabel_id: scenarioWhitelabelId,
        is_premium: productTypeConfig.is_premium,
        active: 1,
        api_token: null,
      })
      .executeTakeFirstOrThrow()

    const userId = Number(userResult.insertId)

    const devSubscriptionData = JSON.stringify({
      cashoffers: {
        managed: productTypeConfig.managed,
        user_config: {
          role: productTypeConfig.role,
          is_premium: productTypeConfig.is_premium,
        },
      },
    })

    const subResult = await db
      .insertInto("Subscriptions")
      .values({
        user_id: userId,
        product_id: resolvedProductId ?? null,
        subscription_name: `[DEV] ${scenario}${productType !== "p-co" ? ` (${productType})` : ""}`,
        amount: 25000,
        status: cfg.status,
        duration: "monthly",
        renewal_date: cfg.renewal_date,
        next_renewal_attempt: cfg.next_renewal_attempt,
        cancel_on_renewal: cfg.cancel_on_renewal,
        downgrade_on_renewal: cfg.downgrade_on_renewal,
        suspension_date: cfg.suspension_date,
        payment_failure_count: cfg.payment_failure_count,
        square_environment: "sandbox",
        data: devSubscriptionData,
        createdAt: now,
        updatedAt: now,
      })
      .executeTakeFirstOrThrow()

    const subscriptionId = Number(subResult.insertId)

    // Create a sandbox card on file so renewal/payment scenarios can charge
    // broken_card flag stores an invalid card_id so Square rejects the charge
    const useInvalidCard = cfg.broken_card
    let cardInfo: { card_id: string; square_customer_id: string; last_4: string; card_brand: string; broken: boolean } | null = null
    try {
      if (useInvalidCard) {
        // Store a fake card record — Square will reject charges against this card_id
        const now2 = new Date()
        await db
          .insertInto("UserCards")
          .values({
            user_id: userId,
            card_id: "ccof:INVALID_FOR_TESTING",
            square_customer_id: "cust:INVALID_FOR_TESTING",
            last_4: "0000",
            card_brand: "NONE",
            exp_month: "12",
            exp_year: "2099",
            cardholder_name: "DEV TEST (broken card)",
            square_environment: "sandbox",
            createdAt: now2,
            updatedAt: now2,
          })
          .executeTakeFirstOrThrow()

        cardInfo = {
          card_id: "ccof:INVALID_FOR_TESTING",
          square_customer_id: "cust:INVALID_FOR_TESTING",
          last_4: "0000",
          card_brand: "NONE",
          broken: true,
        }
      } else {
        const cardResult = await paymentProvider.createCard(
          {
            sourceId: "cnon:card-nonce-ok",
            email: resolvedEmail,
            card: { cardholderName: resolvedName },
          },
          { testMode: true, source: "ADMIN", userId }
        )

        const now2 = new Date()
        await db
          .insertInto("UserCards")
          .values({
            user_id: userId,
            card_id: cardResult.id,
            square_customer_id: cardResult.customerId,
            last_4: cardResult.last4,
            card_brand: cardResult.cardBrand,
            exp_month: String(cardResult.expMonth),
            exp_year: String(cardResult.expYear),
            cardholder_name: cardResult.cardholderName ?? null,
            square_environment: "sandbox",
            createdAt: now2,
            updatedAt: now2,
          })
          .executeTakeFirstOrThrow()

        cardInfo = {
          card_id: cardResult.id,
          square_customer_id: cardResult.customerId,
          last_4: cardResult.last4,
          card_brand: cardResult.cardBrand,
          broken: false,
        }
      }
    } catch (err: any) {
      // Card creation is best-effort — log but don't fail the scenario
      logger.warn("Scenario: failed to create sandbox card on file", { error: err.message, userId })
    }

    // Seed Homeuptick_Subscriptions row so renewal scenarios have HU data
    const huConfigs: Record<string, { base_contacts: number; contacts_per_tier: number; price_per_tier: number }> = {
      "p-co":    { base_contacts: 500, contacts_per_tier: 500, price_per_tier: 7500 },
      "p-hu":    { base_contacts: 500, contacts_per_tier: 500, price_per_tier: 7500 },
      "p-trial": { base_contacts: 0,   contacts_per_tier: 500, price_per_tier: 7500 },
    }
    const huCfg = huConfigs[productType]
    try {
      await db
        .insertInto("Homeuptick_Subscriptions")
        .values({
          user_id: userId,
          active: 1,
          base_contacts: huCfg.base_contacts,
          contacts_per_tier: huCfg.contacts_per_tier,
          price_per_tier: huCfg.price_per_tier,
          free_trial_contacts: null,
          free_trial_days: null,
          free_trial_ends: null,
        })
        .executeTakeFirstOrThrow()
    } catch (err: any) {
      logger.warn("Scenario: failed to seed Homeuptick_Subscriptions", { error: err.message, userId })
    }

    // Set a password so the user can log in via /manage
    const bcryptHash = await (await import("bcrypt")).default.hash("test123", 10)
    await db.updateTable("Users").set({ password: bcryptHash }).where("user_id", "=", userId).execute()

    return c.json({
      success: "success",
      data: {
        scenario,
        product_type: productType,
        user_id: userId,
        email: resolvedEmail,
        subscription_id: subscriptionId,
        card: cardInfo,
        password: "test123",
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
    status: z.enum(["active", "trial", "paused", "cancelled", "inactive", "suspended"]).optional(),
    suspension_date: z.string().datetime().nullable().optional(),
    square_environment: z.enum(["production", "sandbox"]).optional(),
    amount: z.number().int().positive().optional(),
    payment_failure_count: z.number().int().min(0).optional(),
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
    } else if (body.status === "active" && existing.suspension_date != null) {
      patch.suspension_date = null
    }
    if (body.square_environment != null) patch.square_environment = body.square_environment
    if (body.amount != null) patch.amount = body.amount
    if (body.payment_failure_count != null) patch.payment_failure_count = body.payment_failure_count

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

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/card/:user_id/break — Replace card with invalid one to force payment failures
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/card/:user_id/break", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)

    const existingCard = await db
      .selectFrom("UserCards")
      .where("user_id", "=", userId)
      .select(["card_id", "last_4", "card_brand"])
      .executeTakeFirst()

    if (!existingCard) {
      return c.json({ success: "error", error: `No card found for user ${userId}` }, 404)
    }

    if (existingCard.card_id === "ccof:INVALID_FOR_TESTING") {
      return c.json({
        success: "success",
        data: { message: "Card is already broken", user_id: userId },
      })
    }

    const previousCard = {
      card_id: existingCard.card_id,
      last_4: existingCard.last_4,
      card_brand: existingCard.card_brand,
    }

    const now = new Date()
    await db
      .updateTable("UserCards")
      .set({
        card_id: "ccof:INVALID_FOR_TESTING",
        square_customer_id: "cust:INVALID_FOR_TESTING",
        last_4: "0000",
        card_brand: "NONE",
        cardholder_name: "DEV TEST (broken card)",
        updatedAt: now,
      })
      .where("user_id", "=", userId)
      .execute()

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        previous_card: previousCard,
        current_card: { card_id: "ccof:INVALID_FOR_TESTING", last_4: "0000", card_brand: "NONE" },
        message: "Card replaced with invalid card_id. Next payment attempt will fail.",
        hint: "Run yarn dev:tools cron-run " + userId + " to trigger a payment failure.",
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/user/:user_id/set-password — Set password for a user (for testing manage flows)
  // ═══════════════════════════════════════════════════════════════════════════

  const SetPasswordSchema = z.object({
    password: z.string().min(6),
  })

  router.post("/user/:user_id/set-password", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)
    const rawBody = await c.req.json().catch(() => null)
    const parsed = SetPasswordSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: parsed.error.message }, 400)
    }
    const { password } = parsed.data

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["user_id", "email"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    const hash = await bcrypt.hash(password, 10)

    await db
      .updateTable("Users")
      .set({ password: hash })
      .where("user_id", "=", userId)
      .execute()

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        email: user.email,
        message: "Password updated. You can now log in with the new password.",
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/card/:user_id/fix — Restore a broken card with a valid sandbox card
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/card/:user_id/fix", async (c) => {
    const userId = parseInt(c.req.param("user_id"), 10)

    const existingCard = await db
      .selectFrom("UserCards")
      .where("user_id", "=", userId)
      .select(["card_id"])
      .executeTakeFirst()

    if (!existingCard) {
      return c.json({ success: "error", error: `No card found for user ${userId}` }, 404)
    }

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["email", "name"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    // Create a real sandbox card via Square
    const cardResult = await paymentProvider.createCard(
      {
        sourceId: "cnon:card-nonce-ok",
        email: user.email,
        card: { cardholderName: user.name ?? "Dev Test" },
      },
      { testMode: true, source: "ADMIN", userId }
    )

    const now = new Date()
    await db
      .updateTable("UserCards")
      .set({
        card_id: cardResult.id,
        square_customer_id: cardResult.customerId,
        last_4: cardResult.last4,
        card_brand: cardResult.cardBrand,
        exp_month: String(cardResult.expMonth),
        exp_year: String(cardResult.expYear),
        cardholder_name: cardResult.cardholderName ?? null,
        updatedAt: now,
      })
      .where("user_id", "=", userId)
      .execute()

    // Retry renewal for suspended subscriptions (mirrors production CardUpdatedRetryHandler)
    const subscriptions = await subscriptionRepository.findByUserId(userId)
    const needsRetry = subscriptions.filter(
      (s) => s.status === 'suspended' || s.next_renewal_attempt !== null
    )

    const renewalResults: Array<{ subscription_id: number; status: string; result: string }> = []
    for (const sub of needsRetry) {
      try {
        const result = await renewSubscriptionUseCase.execute({
          subscriptionId: sub.subscription_id,
          email: user.email,
          triggeredBy: "card_update",
        })
        renewalResults.push({
          subscription_id: sub.subscription_id,
          status: sub.status ?? 'unknown',
          result: result.success ? 'renewed' : (result as any).error ?? 'failed',
        })
      } catch (error) {
        renewalResults.push({
          subscription_id: sub.subscription_id,
          status: sub.status ?? 'unknown',
          result: `error: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    }

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        card: {
          card_id: cardResult.id,
          last_4: cardResult.last4,
          card_brand: cardResult.cardBrand,
        },
        renewal_retries: renewalResults,
        message: needsRetry.length > 0
          ? `Card restored. Retried ${needsRetry.length} subscription(s).`
          : "Card restored with a valid sandbox card. Next payment attempt will succeed.",
      },
    })
  })

  // ── Verify: Product & Subscription Integrity ─────────────────────────────

  router.get("/verify", async (c) => {
    const issues: Array<{ severity: "error" | "warning"; entity: string; id: number | string; message: string }> = []
    const stats = { products: 0, subscriptions: 0, hu_subscriptions: 0, users_checked: 0 }

    // ── 1. Verify all products ──────────────────────────────────────────
    const products = await db.selectFrom("Products").selectAll().execute()
    stats.products = products.length

    for (const product of products) {
      const data = product.data as any
      const category = product.product_category

      // Check product_category is set
      if (!category) {
        issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "Missing product_category" })
        continue
      }

      // One-time products don't configure users — skip data-structure checks
      if (product.product_type === "one-time") {
        continue
      }

      // Validate category-specific config
      if (category === "premium_cashoffers") {
        if (!data?.cashoffers?.managed) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "premium_cashoffers must have cashoffers.managed=true" })
        }
        if (data?.cashoffers?.user_config?.is_premium == null) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "premium_cashoffers must have user_config.is_premium set" })
        }
        if (!data?.cashoffers?.user_config?.role || data.cashoffers.user_config.role === "SHELL" || data.cashoffers.user_config.role === "HOMEUPTICK") {
          issues.push({ severity: "warning", entity: "Product", id: product.product_id, message: `premium_cashoffers has unexpected role: ${data?.cashoffers?.user_config?.role}` })
        }
      }

      if (category === "external_cashoffers") {
        if (data?.cashoffers?.managed !== false) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "external_cashoffers must have cashoffers.managed=false" })
        }
        if (data?.cashoffers?.user_config?.is_premium === 1) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "external_cashoffers should not have is_premium=1" })
        }
      }

      if (category === "homeuptick_only") {
        if (!data?.cashoffers?.managed) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "homeuptick_only must have cashoffers.managed=true" })
        }
        if (data?.cashoffers?.user_config?.role !== "HOMEUPTICK") {
          issues.push({ severity: "warning", entity: "Product", id: product.product_id, message: `homeuptick_only should have role=HOMEUPTICK, got ${data?.cashoffers?.user_config?.role}` })
        }
        if (data?.cashoffers?.user_config?.is_premium !== 1) {
          issues.push({ severity: "error", entity: "Product", id: product.product_id, message: "homeuptick_only must have user_config.is_premium=1" })
        }
      }

      // Check HomeUptick config exists (all products should have HU config for seeding)
      if (!data?.homeuptick) {
        issues.push({ severity: "warning", entity: "Product", id: product.product_id, message: "No homeuptick config — default will be used at purchase time" })
      }

      // Check whitelabel_code consistency
      if (category === "external_cashoffers" && !product.whitelabel_code) {
        issues.push({ severity: "warning", entity: "Product", id: product.product_id, message: "external_cashoffers product has no whitelabel_code — will be available for all whitelabels" })
      }

      // Warn if product has free_trial configured — billing-managed free trials are WIP
      if (data?.homeuptick?.free_trial?.enabled) {
        issues.push({ severity: "warning", entity: "Product", id: product.product_id, message: "Product has free_trial enabled — billing-managed free trials are WIP and not ready for production. Signup UI does not properly communicate trial terms." })
      }
    }

    // ── 2. Verify all active subscriptions ──────────────────────────────
    const subscriptions = await db
      .selectFrom("Subscriptions")
      .leftJoin("Products", "Products.product_id", "Subscriptions.product_id")
      .selectAll("Subscriptions")
      .select(["Products.product_category", "Products.product_name", "Products.data as product_data"])
      .where("Subscriptions.status", "in", ["active", "trial", "paused", "suspended"])
      .execute()
    stats.subscriptions = subscriptions.length

    // Batch-load all users referenced by active subscriptions (avoids N+1 queries)
    const subUserIds = [...new Set(subscriptions.map((s) => s.user_id).filter((id): id is number => id != null))]
    const usersMap = new Map<number, { user_id: number; is_premium: number | null; role: string | null; active: number | null }>()
    if (subUserIds.length > 0) {
      const users = await db.selectFrom("Users").select(["user_id", "is_premium", "role", "active"]).where("user_id", "in", subUserIds).execute()
      for (const u of users) usersMap.set(u.user_id, u)
    }
    stats.users_checked = usersMap.size

    for (const sub of subscriptions) {
      // Check subscription has a valid product
      if (!sub.product_id) {
        issues.push({ severity: "error", entity: "Subscription", id: sub.subscription_id, message: "No product_id linked" })
        continue
      }

      if (!sub.product_category) {
        issues.push({ severity: "error", entity: "Subscription", id: sub.subscription_id, message: `Product ${sub.product_id} not found or has no category` })
      }

      // Check user exists
      if (sub.user_id) {
        const user = usersMap.get(sub.user_id)

        if (!user) {
          issues.push({ severity: "error", entity: "Subscription", id: sub.subscription_id, message: `User ${sub.user_id} not found in Users table` })
        } else {
          // Verify user state matches product expectations
          const productData = sub.product_data as any
          if (sub.product_category === "premium_cashoffers" && sub.status === "active") {
            if (user.is_premium !== 1) {
              issues.push({ severity: "warning", entity: "Subscription", id: sub.subscription_id, message: `Active premium_cashoffers sub but user ${sub.user_id} has is_premium=${user.is_premium}` })
            }
          }
          if (sub.product_category === "external_cashoffers") {
            if (productData?.cashoffers?.managed === true) {
              issues.push({ severity: "error", entity: "Subscription", id: sub.subscription_id, message: `external_cashoffers subscription linked to managed=true product` })
            }
          }
        }
      } else if (sub.provisioning_status !== "pending_provisioning") {
        issues.push({ severity: "warning", entity: "Subscription", id: sub.subscription_id, message: "No user_id and not pending provisioning" })
      }

      // Check renewal date makes sense
      if (sub.status === "active" && sub.renewal_date) {
        const renewalDate = new Date(sub.renewal_date)
        const now = new Date()
        const sixMonthsAgo = new Date(now)
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        if (renewalDate < sixMonthsAgo) {
          issues.push({ severity: "warning", entity: "Subscription", id: sub.subscription_id, message: `Active subscription with very old renewal_date: ${renewalDate.toISOString()}` })
        }
      }
    }

    // ── 3. Verify Homeuptick_Subscriptions ───────────────────────────────
    const huSubs = await db.selectFrom("Homeuptick_Subscriptions").selectAll().execute()
    stats.hu_subscriptions = huSubs.length

    // Batch-load active subscription user_ids and user existence for HU checks
    const huUserIds = [...new Set(huSubs.map((h) => h.user_id).filter((id): id is number => id != null))]
    const activeSubUserIds = new Set(subscriptions.map((s) => s.user_id).filter((id): id is number => id != null))
    const huUsersMap = new Map<number, boolean>()
    if (huUserIds.length > 0) {
      const huUsers = await db.selectFrom("Users").select("user_id").where("user_id", "in", huUserIds).execute()
      for (const u of huUsers) huUsersMap.set(u.user_id, true)
    }

    for (const hu of huSubs) {
      // Check that the user has a corresponding billing subscription or is a valid external user
      if (!hu.user_id || !activeSubUserIds.has(hu.user_id)) {
        if (!hu.user_id || !huUsersMap.has(hu.user_id)) {
          issues.push({ severity: "error", entity: "Homeuptick_Subscription", id: hu.homeuptick_id, message: `User ${hu.user_id} not found` })
        } else {
          issues.push({ severity: "warning", entity: "Homeuptick_Subscription", id: hu.homeuptick_id, message: `User ${hu.user_id} has HU record but no active billing subscription (may be external user)` })
        }
      }

      // Check required fields
      if (hu.base_contacts == null) {
        issues.push({ severity: "warning", entity: "Homeuptick_Subscription", id: hu.homeuptick_id, message: "Missing base_contacts" })
      }
      if (hu.contacts_per_tier == null) {
        issues.push({ severity: "warning", entity: "Homeuptick_Subscription", id: hu.homeuptick_id, message: "Missing contacts_per_tier" })
      }
    }

    // ── 4. Check for users with subscriptions but no HU record ──────────
    const activeSubs = await db
      .selectFrom("Subscriptions")
      .select("user_id")
      .where("user_id", "is not", null)
      .where("status", "in", ["active", "trial"])
      .execute()

    for (const sub of activeSubs) {
      if (!sub.user_id) continue
      const huRecord = huSubs.find((h) => h.user_id === sub.user_id)
      if (!huRecord) {
        issues.push({ severity: "warning", entity: "User", id: sub.user_id, message: "Active subscription but no Homeuptick_Subscriptions row" })
      }
    }

    const errors = issues.filter((i) => i.severity === "error")
    const warnings = issues.filter((i) => i.severity === "warning")

    return c.json({
      success: "success",
      data: {
        stats,
        summary: {
          total_issues: issues.length,
          errors: errors.length,
          warnings: warnings.length,
          verdict: errors.length === 0 ? "PASS" : "FAIL",
        },
        issues,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/refund/:transaction_id — Refund a transaction by its internal ID
  // ═══════════════════════════════════════════════════════════════════════════

  router.post("/refund/:transaction_id", async (c) => {
    const txId = parseInt(c.req.param("transaction_id"), 10)

    // Find the transaction by internal ID
    const transaction = await db
      .selectFrom("Transactions")
      .where("transaction_id", "=", txId)
      .selectAll()
      .executeTakeFirst()

    if (!transaction) {
      return c.json({ success: "error", error: `Transaction ${txId} not found` }, 404)
    }

    if (transaction.status === "refunded") {
      return c.json({ success: "error", error: `Transaction ${txId} is already refunded` }, 400)
    }

    if (!transaction.square_transaction_id) {
      return c.json({ success: "error", error: `Transaction ${txId} has no square_transaction_id — cannot refund` }, 400)
    }

    const userId = transaction.user_id
    if (!userId) {
      return c.json({ success: "error", error: `Transaction ${txId} has no user_id — cannot refund` }, 400)
    }

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["user_id", "email"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    logger.info("[DEV] Processing refund", {
      userId,
      transactionId: transaction.transaction_id,
      squareTransactionId: transaction.square_transaction_id,
      type: transaction.type,
      amount: transaction.amount,
    })

    const { refundPaymentUseCase } = await import("@api/use-cases/payment")

    const result = await refundPaymentUseCase.execute({
      userId,
      squareTransactionId: transaction.square_transaction_id,
      email: user.email,
      context: {
        testMode: transaction.square_environment === "sandbox",
        source: "ADMIN" as const,
        userId,
      },
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: (result as any).error ?? "Refund failed",
        data: {
          transaction_id: transaction.transaction_id,
          square_transaction_id: transaction.square_transaction_id,
          amount: transaction.amount,
          amount_formatted: formatAmount(transaction.amount),
          type: transaction.type,
        },
      }, 400)
    }

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        email: user.email,
        refund: result.data,
        original_transaction: {
          transaction_id: transaction.transaction_id,
          square_transaction_id: transaction.square_transaction_id,
          amount: transaction.amount,
          amount_formatted: formatAmount(transaction.amount),
          type: transaction.type,
          environment: transaction.square_environment,
        },
        hint: `Check yarn dev:tools state ${userId} for updated transaction log.`,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /dev/property-unlock/:property_token — Test property unlock flow
  // ═══════════════════════════════════════════════════════════════════════════

  const PropertyUnlockSchema = z.object({
    user_id: z.number().int().positive(),
  })

  router.post("/property-unlock/:property_token", async (c) => {
    const propertyToken = c.req.param("property_token")
    const rawBody = await c.req.json().catch(() => null)
    const parsed = PropertyUnlockSchema.safeParse(rawBody)
    if (!parsed.success) {
      return c.json({ success: "error", error: "user_id is required in the request body" }, 400)
    }
    const { user_id: userId } = parsed.data

    const user = await db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select(["user_id", "email", "name"])
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: "error", error: `User ${userId} not found` }, 404)
    }

    logger.info("[DEV] Processing property unlock", { userId, propertyToken })

    // Use the real use case — same code path as production.
    // Passes the sandbox test nonce as the card token (no stored card needed).
    const { unlockPropertyUseCase } = await import("@api/use-cases/property")
    const cardNonce = "cnon:card-nonce-ok" // Square sandbox test nonce

    const result = await unlockPropertyUseCase.execute({
      propertyToken,
      cardToken: cardNonce,
      userId,
      email: user.email,
      context: { testMode: true, source: "ADMIN" as const, userId },
    })

    if (!result.success) {
      return c.json({
        success: "error",
        error: (result as any).error ?? "Property unlock failed",
        code: (result as any).code,
        data: { user_id: userId, property_token: propertyToken },
      }, 400)
    }

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        email: user.email,
        property_token: result.data!.propertyToken,
        property_address: result.data!.propertyAddress,
        transaction_id: result.data!.transactionId,
        square_payment_id: result.data!.squarePaymentId,
        amount: result.data!.amount,
        amount_formatted: formatAmount(result.data!.amount),
        unlocked: result.data!.unlocked,
        card_nonce: cardNonce,
        environment: "sandbox",
        hint: [
          `yarn dev:tools state ${userId}  — verify transaction logged`,
          `yarn dev:tools refund ${userId}  — test refunding this charge`,
        ].join("\n"),
      },
    })
  })

  // ── Auth Link Generator ──────────────────────────────────────────────

  router.get("/auth-link/:user_id", async (c) => {
    const userId = Number(c.req.param("user_id"))
    if (!userId || isNaN(userId)) {
      return c.json({ success: "error", error: "Invalid user_id" }, 400)
    }

    // Look up the user's api_token from the database
    const user = await db
      .selectFrom("Users")
      .select(["api_token"])
      .where("user_id", "=", userId)
      .executeTakeFirst()

    if (!user?.api_token) {
      return c.json({ success: "error", error: "User not found or has no api_token" }, 404)
    }

    // Check if user needs enrollment (premium, no billing subscription)
    const existingSubscription = await db
      .selectFrom("Subscriptions")
      .select("subscription_id")
      .where("user_id", "=", userId)
      .where("status", "in", ["active", "trial", "paused"])
      .executeTakeFirst()

    const fullUser = await db
      .selectFrom("Users")
      .select(["is_premium"])
      .where("user_id", "=", userId)
      .executeTakeFirst()

    const needsEnrollment = !existingSubscription && fullUser

    const jwt = await import("jsonwebtoken")
    const token = jwt.default.sign({ api_token: user.api_token }, config.jwtSecret, { expiresIn: "30d" })

    const params = new URLSearchParams({ token })
    if (needsEnrollment) {
      params.set("goto", "enrollment")
    }
    const manageUrl = `http://localhost:3000/manage?${params.toString()}`

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        token,
        manage_url: manageUrl,
        expires_in: "30 days",
        goto: needsEnrollment ? "enrollment" : undefined,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/logs — Query BillingLogs with filters (sensitive data redacted)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/logs", async (c) => {
    const q = c.req.query()
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 500)
    const sinceHours = q.since ? parseFloat(q.since) : null

    let query = db
      .selectFrom("BillingLogs")
      .select([
        "log_id", "level", "component", "context_type", "message",
        "metadata", "request_id", "user_id", "error_stack", "service", "createdAt",
      ])
      .orderBy("createdAt", "desc")
      .limit(limit)

    if (q.user_id) {
      const uid = parseInt(q.user_id, 10)
      if (!isNaN(uid)) query = query.where("user_id", "=", uid)
    }
    if (q.level && ["debug", "info", "warn", "error"].includes(q.level)) {
      query = query.where("level", "=", q.level as "debug" | "info" | "warn" | "error")
    }
    if (q.context_type && ["http_request", "cron_job", "event_handler", "background"].includes(q.context_type)) {
      query = query.where("context_type", "=", q.context_type as any)
    }
    if (q.component) query = query.where("component", "=", q.component)
    if (q.request_id) query = query.where("request_id", "=", q.request_id)
    if (q.search) query = query.where("message", "like", `%${q.search}%`)
    if (sinceHours != null && !isNaN(sinceHours)) {
      query = query.where("createdAt", ">=", new Date(Date.now() - sinceHours * 3600_000))
    }

    const rows = await query.execute()

    const redacted = rows.map((r) => ({
      ...r,
      metadata: redactSensitive(r.metadata),
    }))

    return c.json({
      success: "success",
      data: {
        count: redacted.length,
        filters: {
          user_id: q.user_id ?? null,
          level: q.level ?? null,
          component: q.component ?? null,
          context_type: q.context_type ?? null,
          request_id: q.request_id ?? null,
          search: q.search ?? null,
          since_hours: sinceHours,
          limit,
        },
        logs: redacted,
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/logs/:log_id — Single log entry with full detail
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/logs/:log_id", async (c) => {
    const logId = parseInt(c.req.param("log_id"), 10)
    if (!logId || isNaN(logId)) {
      return c.json({ success: "error", error: "Invalid log_id" }, 400)
    }

    const row = await db
      .selectFrom("BillingLogs")
      .where("log_id", "=", logId)
      .selectAll()
      .executeTakeFirst()

    if (!row) return c.json({ success: "error", error: `Log ${logId} not found` }, 404)

    return c.json({
      success: "success",
      data: {
        ...row,
        metadata: redactSensitive(row.metadata),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/logs/request/:request_id — All logs for one request
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/logs/request/:request_id", async (c) => {
    const requestId = c.req.param("request_id")
    if (!requestId) return c.json({ success: "error", error: "Missing request_id" }, 400)

    const rows = await db
      .selectFrom("BillingLogs")
      .where("request_id", "=", requestId)
      .select([
        "log_id", "level", "component", "context_type", "message",
        "metadata", "user_id", "error_stack", "createdAt",
      ])
      .orderBy("createdAt", "asc")
      .execute()

    return c.json({
      success: "success",
      data: {
        request_id: requestId,
        count: rows.length,
        logs: rows.map((r) => ({ ...r, metadata: redactSensitive(r.metadata) })),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/query/subscriptions — Query Subscriptions with filters
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/query/subscriptions", async (c) => {
    const q = c.req.query()
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 500)

    let query = db
      .selectFrom("Subscriptions")
      .leftJoin("Products", "Products.product_id", "Subscriptions.product_id")
      .select([
        "Subscriptions.subscription_id",
        "Subscriptions.subscription_name",
        "Subscriptions.user_id",
        "Subscriptions.product_id",
        "Subscriptions.status",
        "Subscriptions.amount",
        "Subscriptions.duration",
        "Subscriptions.renewal_date",
        "Subscriptions.next_renewal_attempt",
        "Subscriptions.cancel_on_renewal",
        "Subscriptions.downgrade_on_renewal",
        "Subscriptions.suspension_date",
        "Subscriptions.payment_failure_count",
        "Subscriptions.square_environment",
        "Subscriptions.data",
        "Subscriptions.createdAt",
        "Subscriptions.updatedAt",
        "Products.product_name",
      ])
      .orderBy("Subscriptions.createdAt", "desc")
      .limit(limit)

    if (q.user_id) {
      const uid = parseInt(q.user_id, 10)
      if (!isNaN(uid)) query = query.where("Subscriptions.user_id", "=", uid)
    }
    if (q.status) query = query.where("Subscriptions.status", "=", q.status as any)
    if (q.product_id) {
      const pid = parseInt(q.product_id, 10)
      if (!isNaN(pid)) query = query.where("Subscriptions.product_id", "=", pid)
    }
    if (q.overdue === "true") {
      query = query
        .where("Subscriptions.status", "=", "active")
        .where("Subscriptions.renewal_date", "<=", new Date())
    }
    if (q.failures_gte) {
      const n = parseInt(q.failures_gte, 10)
      if (!isNaN(n)) query = query.where("Subscriptions.payment_failure_count", ">=", n)
    }

    const rows = await query.execute()

    return c.json({
      success: "success",
      data: {
        count: rows.length,
        subscriptions: rows.map((s) => ({
          ...s,
          data: redactSensitive(s.data),
          amount_formatted: formatAmount(s.amount),
          renewal_in: daysFromNow(s.renewal_date),
        })),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/query/transactions — Query Transactions with filters
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/query/transactions", async (c) => {
    const q = c.req.query()
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 500)
    const sinceHours = q.since ? parseFloat(q.since) : null

    let query = db
      .selectFrom("Transactions")
      .select([
        "transaction_id", "user_id", "product_id", "type", "status", "amount",
        "memo", "square_transaction_id", "square_environment", "data", "createdAt",
      ])
      .orderBy("createdAt", "desc")
      .limit(limit)

    if (q.user_id) {
      const uid = parseInt(q.user_id, 10)
      if (!isNaN(uid)) query = query.where("user_id", "=", uid)
    }
    if (q.status) query = query.where("status", "=", q.status)
    if (q.type) query = query.where("type", "=", q.type)
    if (sinceHours != null && !isNaN(sinceHours)) {
      query = query.where("createdAt", ">=", new Date(Date.now() - sinceHours * 3600_000))
    }

    const rows = await query.execute()

    return c.json({
      success: "success",
      data: {
        count: rows.length,
        transactions: rows.map((t) => ({
          ...t,
          data: redactSensitive(t.data),
          amount_formatted: formatAmount(t.amount),
        })),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/query/purchase-requests — Query PurchaseRequests with filters
  //
  // PurchaseRequests track every purchase attempt (new purchase, renewal,
  // upgrade) with granular status transitions. Critical for spotting requests
  // that failed mid-flow: a row stuck in VALIDATING / PROCESSING_PAYMENT /
  // CREATING_SUBSCRIPTION / FINALIZING / PENDING is one where the system lost
  // track (crash, unhandled error, deploy interruption). Use `--stuck` to
  // surface exactly those rows.
  // ═══════════════════════════════════════════════════════════════════════════

  const PURCHASE_REQUEST_IN_PROGRESS_STATUSES = [
    "PENDING",
    "VALIDATING",
    "PROCESSING_PAYMENT",
    "CREATING_SUBSCRIPTION",
    "FINALIZING",
  ] as const

  router.get("/query/purchase-requests", async (c) => {
    const q = c.req.query()
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 500)
    const sinceHours = q.since ? parseFloat(q.since) : null
    const stuckMinutes = q.stuck_minutes ? parseFloat(q.stuck_minutes) : 5

    let query = db
      .selectFrom("PurchaseRequests")
      .leftJoin("Products", "Products.product_id", "PurchaseRequests.product_id")
      .select([
        "PurchaseRequests.request_id",
        "PurchaseRequests.request_uuid",
        "PurchaseRequests.request_type",
        "PurchaseRequests.source",
        "PurchaseRequests.user_id",
        "PurchaseRequests.email",
        "PurchaseRequests.product_id",
        "PurchaseRequests.subscription_id",
        "PurchaseRequests.status",
        "PurchaseRequests.failure_reason",
        "PurchaseRequests.error_code",
        "PurchaseRequests.retry_count",
        "PurchaseRequests.max_retries",
        "PurchaseRequests.next_retry_at",
        "PurchaseRequests.subscription_id_result",
        "PurchaseRequests.transaction_id_result",
        "PurchaseRequests.amount_charged",
        "PurchaseRequests.user_created",
        "PurchaseRequests.prorated_amount",
        "PurchaseRequests.started_at",
        "PurchaseRequests.completed_at",
        "PurchaseRequests.processing_duration_ms",
        "PurchaseRequests.createdAt",
        "PurchaseRequests.updatedAt",
        "Products.product_name",
      ])
      .orderBy("PurchaseRequests.createdAt", "desc")
      .limit(limit)

    if (q.user_id) {
      const uid = parseInt(q.user_id, 10)
      if (!isNaN(uid)) query = query.where("PurchaseRequests.user_id", "=", uid)
    }
    if (q.email) query = query.where("PurchaseRequests.email", "like", `%${q.email}%`)
    if (q.status) query = query.where("PurchaseRequests.status", "=", q.status.toUpperCase() as any)
    if (q.request_type) {
      query = query.where("PurchaseRequests.request_type", "=", q.request_type.toUpperCase() as any)
    }
    if (q.source) query = query.where("PurchaseRequests.source", "=", q.source.toUpperCase() as any)
    if (sinceHours != null && !isNaN(sinceHours)) {
      query = query.where("PurchaseRequests.createdAt", ">=", new Date(Date.now() - sinceHours * 3600_000))
    }
    if (q.stuck === "true" && !isNaN(stuckMinutes)) {
      query = query
        .where("PurchaseRequests.status", "in", PURCHASE_REQUEST_IN_PROGRESS_STATUSES as unknown as any)
        .where("PurchaseRequests.updatedAt", "<=", new Date(Date.now() - stuckMinutes * 60_000))
    }

    const rows = await query.execute()

    return c.json({
      success: "success",
      data: {
        count: rows.length,
        filters: {
          user_id: q.user_id ?? null,
          email: q.email ?? null,
          status: q.status ?? null,
          request_type: q.request_type ?? null,
          source: q.source ?? null,
          since_hours: sinceHours,
          stuck: q.stuck === "true",
          stuck_minutes: q.stuck === "true" ? stuckMinutes : null,
          limit,
        },
        purchase_requests: rows.map((r) => ({
          ...r,
          amount_charged_formatted: formatAmount(r.amount_charged),
          prorated_amount_formatted: formatAmount(r.prorated_amount),
          user_created: Boolean(r.user_created),
          is_stuck:
            PURCHASE_REQUEST_IN_PROGRESS_STATUSES.includes(r.status as any) &&
            r.updatedAt.getTime() < Date.now() - stuckMinutes * 60_000,
        })),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/query/purchase-request/:request_id — Single purchase request
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/query/purchase-request/:request_id", async (c) => {
    const idParam = c.req.param("request_id")
    const numericId = parseInt(idParam, 10)
    const isNumeric = !isNaN(numericId) && String(numericId) === idParam

    let query = db
      .selectFrom("PurchaseRequests")
      .leftJoin("Products", "Products.product_id", "PurchaseRequests.product_id")
      .selectAll("PurchaseRequests")
      .select(["Products.product_name"])

    query = isNumeric
      ? query.where("PurchaseRequests.request_id", "=", numericId)
      : query.where("PurchaseRequests.request_uuid", "=", idParam)

    const row = await query.executeTakeFirst()

    if (!row) {
      return c.json({ success: "error", error: `Purchase request ${idParam} not found` }, 404)
    }

    return c.json({
      success: "success",
      data: {
        ...row,
        request_data: redactSensitive(row.request_data),
        amount_charged_formatted: formatAmount(row.amount_charged),
        prorated_amount_formatted: formatAmount(row.prorated_amount),
        user_created: Boolean(row.user_created),
      },
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /dev/query/find-user — Find users by email substring
  // ═══════════════════════════════════════════════════════════════════════════

  router.get("/query/find-user", async (c) => {
    const q = c.req.query()
    const email = q.email
    if (!email) return c.json({ success: "error", error: "Missing email query param" }, 400)

    const limit = Math.min(parseInt(q.limit ?? "20", 10) || 20, 100)

    const rows = await db
      .selectFrom("Users")
      .select([
        "user_id", "email", "name", "role", "is_premium", "active",
        "whitelabel_id", "created",
      ])
      .where("email", "like", `%${email}%`)
      .orderBy("created", "desc")
      .limit(limit)
      .execute()

    return c.json({
      success: "success",
      data: {
        count: rows.length,
        users: rows.map((u) => ({
          ...u,
          is_premium: Boolean(u.is_premium),
          active: Boolean(u.active),
        })),
      },
    })
  })
}

export const devRoutes = app
