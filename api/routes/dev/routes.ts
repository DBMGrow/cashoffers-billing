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

    const cfg = scenarioConfigs[scenario]
    const scenarioWhitelabelId = cfg.whitelabel_id ?? 1

    // Product type determines CO managed flag, user role, is_premium, and product_category
    const productTypeConfig = {
      "p-co":    { managed: true,  role: "AGENT" as const, is_premium: 1, product_category: "premium_cashoffers" as const },
      "p-hu":    { managed: false, role: "AGENT" as const, is_premium: 0, product_category: "external_cashoffers" as const },
      "p-trial": { managed: true,  role: "SHELL" as const, is_premium: 0, product_category: "homeuptick_only" as const },
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
      productData: {
        cashoffers: {
          managed: productTypeConfig.managed,
          user_config: {
            role: productTypeConfig.role,
            is_premium: productTypeConfig.is_premium,
            whitelabel_id: scenarioWhitelabelId,
          },
        },
      },
      user_config: { whitelabel_id: scenarioWhitelabelId },
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

    return c.json({
      success: "success",
      data: {
        scenario,
        product_type: productType,
        user_id: userId,
        email: resolvedEmail,
        subscription_id: subscriptionId,
        card: cardInfo,
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

    return c.json({
      success: "success",
      data: {
        user_id: userId,
        card: {
          card_id: cardResult.id,
          last_4: cardResult.last4,
          card_brand: cardResult.cardBrand,
        },
        message: "Card restored with a valid sandbox card. Next payment attempt will succeed.",
      },
    })
  })
}

export const devRoutes = app
