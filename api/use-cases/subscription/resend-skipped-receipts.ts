/**
 * Resend the subscription-created receipt to existing-user purchases that skipped it (desk-1727).
 *
 * Until the `provisioningFailed` fix, the receipt handler read `userWasCreated === false` as
 * "provisioning failed", and the existing-user purchase flow always sends `false` because it creates
 * no user. Every ExpressOffers Guest who bought Pro was charged and sent nothing, so neither the
 * agent nor the billing@ BCC ever saw the receipt.
 *
 * A subscription qualifies when the billing log shows all of:
 *   - "Existing user purchase completed successfully" for it (a real, finished purchase), and
 *   - the provisioning-failed skip for it (the receipt never went), and
 *   - no stamp from an earlier resend (so a re-run sends nothing twice).
 * A new-user purchase whose provisioning really failed never logs the first line, so it is never
 * picked up. A Square sandbox charge is a test purchase and is skipped.
 *
 * Each receipt is replayed through the real EmailNotificationHandler, so template, branding and
 * the production BCC are exactly what a live purchase sends, dated the day the card was charged.
 * The handler is called directly, not through the event bus, so no account, HomeUptick or
 * commission handler runs again.
 *
 * Sending only works from production: SendGrid's IP allowlist refuses any other host. Run it
 * through `POST /api/cron/resend-subscription-receipts`; the script of the same name is for a
 * local dry run.
 */

import { sql } from "kysely"
import { db } from "@api/lib/database"
import { emailService, logger } from "@api/lib/services"
import { billingLogRepository } from "@api/lib/repositories"
import { createConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { EmailNotificationHandler } from "@api/application/event-handlers/email-notification.handler"
import { SubscriptionCreatedEvent } from "@api/domain/events/subscription-created.event"
import type { IEmailService, SendEmailRequest } from "@api/infrastructure/email/email-service.interface"

const COMPLETED = "Existing user purchase completed successfully"
const SKIPPED = "Skipping subscription created email — user provisioning failed"
const STAMP = "Resent subscription created email (desk-1727)"

export interface ResendSkippedReceiptsResult {
  apply: boolean
  /** Sent (apply) or would be sent (dry run). */
  sent: Array<{ subscriptionId: number; userId: number; subject: string; chargedAt: string }>
  /** Square sandbox charges, left out. */
  sandbox: number[]
  /** Left for a person: no matching charge, a charge that is not one period, or the handler sent nothing. */
  needsReview: Array<{ subscriptionId: number; reason: string }>
  alreadyResent: number
}

const bySubscription = (message: string) =>
  db
    .selectFrom("BillingLogs")
    .select(
      sql<number>`CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.subscriptionId')) AS UNSIGNED)`.as("subscription_id")
    )
    .where("message", "=", message)

export async function resendSkippedReceipts(opts: {
  apply: boolean
  /** Called with each rendered receipt, for a dry run that saves them to look at. */
  onRendered?: (subscriptionId: number, req: SendEmailRequest) => void
}): Promise<ResendSkippedReceiptsResult> {
  const { apply } = opts
  const [completed, skipped, stamped] = await Promise.all(
    [COMPLETED, SKIPPED, STAMP].map(
      async (m) => new Set((await bySubscription(m).execute()).map((r) => Number(r.subscription_id)))
    )
  )
  const ids = [...completed].filter((id) => skipped.has(id) && !stamped.has(id)).sort((a, b) => a - b)
  const result: ResendSkippedReceiptsResult = {
    apply,
    sent: [],
    sandbox: [],
    needsReview: [],
    alreadyResent: stamped.size,
  }
  if (ids.length === 0) return result

  const rows = await db
    .selectFrom("Subscriptions as s")
    .innerJoin("Products as p", "p.product_id", "s.product_id")
    .innerJoin("Users as u", "u.user_id", "s.user_id")
    .select([
      "s.subscription_id",
      "s.user_id",
      "s.product_id",
      "s.amount",
      "s.renewal_date",
      "s.createdAt",
      "p.product_name",
      "u.email",
    ])
    .where("s.subscription_id", "in", ids)
    .orderBy("s.subscription_id")
    .execute()

  for (const row of rows) {
    // The charge for this purchase: same user and product, written within a minute of the subscription.
    const charge = await db
      .selectFrom("Transactions")
      .select(["amount", "square_transaction_id", "square_environment", "createdAt"])
      .where("user_id", "=", row.user_id)
      .where("product_id", "=", row.product_id)
      .where("type", "=", "payment")
      .where("square_transaction_id", "is not", null)
      .where(sql<boolean>`ABS(TIMESTAMPDIFF(SECOND, createdAt, ${row.createdAt})) < 60`)
      .orderBy("createdAt", "asc")
      .executeTakeFirst()

    const renewalCost = Number(row.amount)
    // A charge that is not exactly one period means a signup fee or a promo, whose line items this
    // would have to guess. Leave those for a person rather than send a wrong receipt.
    if (!charge || Number(charge.amount) !== renewalCost || !row.email || !row.user_id || !row.product_id) {
      result.needsReview.push({
        subscriptionId: row.subscription_id,
        reason: `charge ${charge?.amount ?? "not found"}, period ${renewalCost}`,
      })
      continue
    }

    // A Square sandbox charge is a test purchase (no money moved). Its receipt says [SANDBOX] and
    // its BCC would show billing@ a signup that never happened, so leave it out.
    if (charge.square_environment === "sandbox") {
      result.sandbox.push(row.subscription_id)
      continue
    }

    const event = SubscriptionCreatedEvent.create({
      subscriptionId: row.subscription_id,
      userId: row.user_id,
      email: row.email,
      productId: row.product_id,
      productName: row.product_name,
      amount: renewalCost,
      initialChargeAmount: Number(charge.amount),
      externalTransactionId: charge.square_transaction_id ?? undefined,
      userWasCreated: false,
      provisioningFailed: false,
      nextRenewalDate: row.renewal_date ?? undefined,
      environment: "production",
      source: "RESEND",
      lineItems: [{ description: row.product_name, amount: renewalCost }],
    })
    // Date the receipt the day the card was charged, not the day it is resent.
    ;(event as { occurredAt: Date }).occurredAt = new Date(charge.createdAt)

    // Recorded only once SendGrid accepts it: the handler swallows send errors (safeExecute).
    let delivered: SendEmailRequest | null = null
    const capture: IEmailService = {
      sendEmail: async (req) => {
        if (apply) await emailService.sendEmail(req)
        delivered = req
      },
      sendPlainEmail: (req) => emailService.sendPlainEmail(req),
    }
    // A dry run logs to the console only, so it writes nothing to BillingLogs.
    const handlerLogger = apply ? logger : createConsoleLogger({ service: "cashoffers-billing" })
    await new EmailNotificationHandler(capture, handlerLogger).handle(event)

    const req = delivered as SendEmailRequest | null
    if (!req) {
      result.needsReview.push({
        subscriptionId: row.subscription_id,
        reason: "the receipt handler sent nothing; see its log",
      })
      continue
    }
    opts.onRendered?.(row.subscription_id, req)

    if (apply) {
      // Awaited, unlike logger.info, so the stamp is written before the next send.
      await billingLogRepository.create({
        level: "info",
        message: STAMP,
        component: "resend-subscription-receipts",
        context_type: "background",
        metadata: JSON.stringify({ subscriptionId: row.subscription_id, transactionId: charge.square_transaction_id }),
        error_stack: null,
        request_id: null,
        user_id: row.user_id,
        service: "cashoffers-billing",
      })
    }
    result.sent.push({
      subscriptionId: row.subscription_id,
      userId: row.user_id,
      subject: req.subject,
      chargedAt: new Date(charge.createdAt).toISOString(),
    })
  }

  return result
}
