import { Kysely, Selectable, sql } from "kysely"
import type { DB, PromoCodes, PromoRedemptions } from "@api/lib/db"
import type { PromoDefinition, PromoEvaluation } from "@api/domain/services/promo-evaluation"
import { normalizePromoCode } from "@api/domain/services/promo-evaluation"

export interface PromoRedemptionCounts {
  /** Non-voided redemptions of the code by everyone (this purchase request excluded). */
  total: number
  /** Non-voided redemptions of the code by this buyer, matched on email or user id. */
  forUser: number
}

export interface ReservePromoInput {
  code: string
  email: string
  userId: number | null
  purchaseRequestId: number
  productId: number
  whitelabelCode: string | null
  /** Runs inside the lock with the counts it must respect. Pure: `evaluatePromo` bound to the purchase. */
  decide: (promo: PromoDefinition | null, counts: PromoRedemptionCounts) => PromoEvaluation
}

export interface ReservePromoResult {
  evaluation: PromoEvaluation
  /** Set when the evaluation passed and a redemption row now holds this purchase's place. */
  redemptionId: number | null
}

function parseJsonArray<T>(value: unknown): T[] | null {
  if (value == null) return null
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  return Array.isArray(parsed) ? (parsed as T[]) : null
}

export function toPromoDefinition(row: Selectable<PromoCodes>): PromoDefinition {
  return {
    promo_id: row.promo_id,
    code: row.code.toUpperCase(),
    description: row.description,
    whitelabel_code: row.whitelabel_code,
    product_ids: parseJsonArray<number | string>(row.product_ids)?.map((id) => Number(id)) ?? null,
    product_roles: parseJsonArray<string>(row.product_roles),
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    applies_to: row.applies_to,
    duration_periods: row.duration_periods,
    max_redemptions: row.max_redemptions,
    max_per_user: row.max_per_user,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    active: Number(row.active) === 1,
    new_users_only: Number(row.new_users_only) === 1,
    campaign: row.campaign,
  }
}

/**
 * Promo code repository: PromoCodes and PromoRedemptions.
 *
 * `reserve` is the only write a purchase makes before it charges. It locks the code's row
 * (`SELECT ... FOR UPDATE`), counts redemptions, lets the caller's pure `decide` apply the limits,
 * and inserts the redemption, all in one transaction. Two purchases racing for the last redemption
 * serialize on the row lock, and the second sees the first one's row (InnoDB takes the read view
 * at the first plain read, the COUNT, which runs only after the lock is granted). `purchase_request_id`
 * is UNIQUE, so one purchase request holds at most one redemption.
 */
export class PromoCodeRepository {
  constructor(private db: Kysely<DB>) {}

  async findByCode(code: string): Promise<PromoDefinition | null> {
    const normalized = normalizePromoCode(code)
    if (!normalized) return null
    const row = await this.db.selectFrom("PromoCodes").where("code", "=", normalized).selectAll().executeTakeFirst()
    return row ? toPromoDefinition(row) : null
  }

  /** Non-voided redemptions of a code by everyone. */
  async countRedemptions(promoId: number): Promise<number> {
    const row = await this.db
      .selectFrom("PromoRedemptions")
      .where("promo_id", "=", promoId)
      .where("status", "!=", "voided")
      .select(sql<number>`COUNT(*)`.as("n"))
      .executeTakeFirst()
    return Number(row?.n ?? 0)
  }

  async reserve(input: ReservePromoInput): Promise<ReservePromoResult> {
    const normalized = normalizePromoCode(input.code)
    const email = input.email.trim().toLowerCase()

    return this.db.transaction().execute(async (trx) => {
      const row = normalized
        ? await trx.selectFrom("PromoCodes").where("code", "=", normalized).selectAll().forUpdate().executeTakeFirst()
        : undefined
      const promo = row ? toPromoDefinition(row) : null
      if (!promo) return { evaluation: input.decide(null, { total: 0, forUser: 0 }), redemptionId: null }

      const counted = trx
        .selectFrom("PromoRedemptions")
        .where("promo_id", "=", promo.promo_id)
        .where("status", "!=", "voided")
        .where("purchase_request_id", "!=", input.purchaseRequestId)

      const totalRow = await counted.select(sql<number>`COUNT(*)`.as("n")).executeTakeFirst()
      const userRow = await counted
        .where((eb) =>
          input.userId != null
            ? eb.or([eb("email", "=", email), eb("user_id", "=", input.userId)])
            : eb("email", "=", email)
        )
        .select(sql<number>`COUNT(*)`.as("n"))
        .executeTakeFirst()

      const evaluation = input.decide(promo, { total: Number(totalRow?.n ?? 0), forUser: Number(userRow?.n ?? 0) })
      if (!evaluation.ok) return { evaluation, redemptionId: null }

      const values = {
        promo_id: promo.promo_id,
        code: promo.code,
        user_id: input.userId,
        email,
        subscription_id: null,
        purchase_request_id: input.purchaseRequestId,
        product_id: input.productId,
        whitelabel_code: input.whitelabelCode,
        original_amount: evaluation.originalAmount,
        discount_amount: evaluation.discountAmount,
        charged_amount: evaluation.chargedAmount,
        periods_total: evaluation.periodsTotal,
        periods_remaining: evaluation.periodsRemaining,
        // "exhausted" is left to the renewal phase that consumes periods_remaining.
        status: "applied" as const,
      }

      // Same purchase request again: reuse its row rather than insert a second one.
      const existing = await trx
        .selectFrom("PromoRedemptions")
        .where("purchase_request_id", "=", input.purchaseRequestId)
        .select("redemption_id")
        .executeTakeFirst()
      if (existing) {
        await trx
          .updateTable("PromoRedemptions")
          .set({ ...values, updatedAt: new Date() })
          .where("redemption_id", "=", existing.redemption_id)
          .execute()
        return { evaluation, redemptionId: existing.redemption_id }
      }

      const inserted = await trx.insertInto("PromoRedemptions").values(values).executeTakeFirstOrThrow()
      return { evaluation, redemptionId: Number(inserted.insertId) }
    })
  }

  /** Links the redemption to the subscription it bought (and the user, when known). */
  async attachSubscription(redemptionId: number, subscriptionId: number, userId: number | null): Promise<void> {
    await this.db
      .updateTable("PromoRedemptions")
      .set({ subscription_id: subscriptionId, ...(userId != null ? { user_id: userId } : {}), updatedAt: new Date() })
      .where("redemption_id", "=", redemptionId)
      .execute()
  }

  async setUserId(redemptionId: number, userId: number): Promise<void> {
    await this.db
      .updateTable("PromoRedemptions")
      .set({ user_id: userId, updatedAt: new Date() })
      .where("redemption_id", "=", redemptionId)
      .execute()
  }

  /** Releases a reservation whose purchase failed before anything was charged or created. */
  async voidRedemption(redemptionId: number): Promise<void> {
    await this.db
      .updateTable("PromoRedemptions")
      .set({ status: "voided", updatedAt: new Date() })
      .where("redemption_id", "=", redemptionId)
      .execute()
  }

  async findByPurchaseRequestId(purchaseRequestId: number): Promise<Selectable<PromoRedemptions> | null> {
    const row = await this.db
      .selectFrom("PromoRedemptions")
      .where("purchase_request_id", "=", purchaseRequestId)
      .selectAll()
      .executeTakeFirst()
    return row ?? null
  }
}

export const createPromoCodeRepository = (db: Kysely<DB>): PromoCodeRepository => {
  return new PromoCodeRepository(db)
}
