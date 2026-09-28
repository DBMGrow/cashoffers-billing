import { describe, it, expect } from "vitest"
import {
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely"
import type { DB } from "@api/lib/db"
import { PromoCodeRepository } from "./promo-code.repository"
import { evaluatePromo } from "@api/domain/services/promo-evaluation"

/**
 * A Kysely driver over two in-memory tables. It answers only the statements PromoCodeRepository
 * issues, so the test exercises the real query builder (and fails loudly on a statement it does not
 * recognise) without a database.
 */
function memoryDb() {
  const log: string[] = []
  const promoRow = {
    promo_id: 1,
    code: "EXPCON",
    description: null,
    whitelabel_code: "EXP",
    product_ids: null,
    product_roles: '["AGENT_EXP_PRO"]',
    discount_type: "free_periods",
    discount_value: 1,
    applies_to: "first_period",
    duration_periods: 1,
    max_redemptions: 2,
    max_per_user: 1,
    starts_at: null,
    ends_at: null,
    active: 1,
    new_users_only: 0,
    campaign: "eXpCon 2026",
    external_coupon_id: null,
    created_by: null,
  }
  const redemptions: Array<Record<string, any>> = []

  const run = (query: CompiledQuery): QueryResult<any> => {
    const sql = query.sql
    const p = query.parameters as unknown[]
    log.push(sql)
    if (sql.startsWith("select * from `PromoCodes`")) {
      return { rows: p[0] === promoRow.code ? [promoRow] : [] }
    }
    if (sql.startsWith("select COUNT(*) as `n` from `PromoRedemptions`")) {
      // where promo_id = ? and status != ? and purchase_request_id != ? [and (email = ? or user_id = ?)]
      let rows = redemptions.filter((r) => r.promo_id === p[0] && r.status !== p[1] && r.purchase_request_id !== p[2])
      if (p.length > 3) rows = rows.filter((r) => r.email === p[3] || (p.length > 4 && r.user_id === p[4]))
      return { rows: [{ n: rows.length }] }
    }
    if (sql.startsWith("select `redemption_id` from `PromoRedemptions`")) {
      return { rows: redemptions.filter((r) => r.purchase_request_id === p[0]) }
    }
    if (sql.startsWith("insert into `PromoRedemptions`")) {
      const columns = sql
        .match(/\(([^)]+)\) values/)![1]
        .split(",")
        .map((c) => c.trim().replace(/`/g, ""))
      const row: Record<string, any> = { redemption_id: redemptions.length + 1 }
      columns.forEach((c, i) => (row[c] = p[i]))
      if (redemptions.some((r) => r.purchase_request_id === row.purchase_request_id)) {
        throw new Error("ER_DUP_ENTRY uq_redemption_purchase_request")
      }
      redemptions.push(row)
      return { rows: [], insertId: BigInt(row.redemption_id), numAffectedRows: BigInt(1) }
    }
    if (sql.startsWith("update `PromoRedemptions`")) {
      const id = p[p.length - 1]
      const sets = sql
        .match(/set (.+) where/)![1]
        .split(",")
        .map((s) => s.trim().split(" = ")[0].replace(/`/g, ""))
      const row = redemptions.find((r) => r.redemption_id === id)
      sets.forEach((c, i) => row && (row[c] = p[i]))
      return { rows: [], numAffectedRows: BigInt(row ? 1 : 0) }
    }
    throw new Error(`memoryDb: unexpected statement: ${sql}`)
  }

  const connection: DatabaseConnection = {
    executeQuery: async (query) => run(query),
    streamQuery: () => {
      throw new Error("not supported")
    },
  }
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {
      log.push("begin")
    },
    commitTransaction: async () => {
      log.push("commit")
    },
    rollbackTransaction: async () => {
      log.push("rollback")
    },
    releaseConnection: async () => {},
    destroy: async () => {},
  }
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver,
      createIntrospector: (k) => new MysqlIntrospector(k),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
  })
  return { db, log, redemptions }
}

const pricing = { signupFee: 0, renewalCost: 4900, productDuration: "monthly", initialAmount: 4900 }
const product = { product_id: 70, whitelabel_code: "EXP", role_v2: "AGENT_EXP_PRO" }

function reserveInput(purchaseRequestId: number, email: string) {
  return {
    code: "expcon",
    email,
    userId: null,
    purchaseRequestId,
    productId: 70,
    whitelabelCode: "EXP",
    decide: (promo: any, counts: { total: number; forUser: number }) =>
      evaluatePromo(promo, {
        product,
        pricing,
        now: new Date(),
        priorRedemptionsForUser: counts.forUser,
        totalRedemptions: counts.total,
      }),
  }
}

describe("PromoCodeRepository.reserve", () => {
  it("locks the code row inside a transaction and records the redemption", async () => {
    const { db, log, redemptions } = memoryDb()
    const repo = new PromoCodeRepository(db)
    const result = await repo.reserve(reserveInput(501, "Agent@Exp.test"))

    expect(result.evaluation.ok).toBe(true)
    expect(result.redemptionId).toBe(1)
    expect(log[0]).toBe("begin")
    expect(log.find((s) => s.startsWith("select * from `PromoCodes`"))).toMatch(/for update$/)
    expect(log[log.length - 1]).toBe("commit")
    expect(redemptions).toHaveLength(1)
    expect(redemptions[0]).toMatchObject({
      code: "EXPCON",
      email: "agent@exp.test",
      purchase_request_id: 501,
      original_amount: 4900,
      discount_amount: 4900,
      charged_amount: 0,
      status: "applied",
    })
  })

  it("records one redemption per purchase_request_id however often the purchase runs it", async () => {
    const { db, redemptions } = memoryDb()
    const repo = new PromoCodeRepository(db)
    const first = await repo.reserve(reserveInput(501, "agent@exp.test"))
    const again = await repo.reserve(reserveInput(501, "agent@exp.test"))

    expect(first.redemptionId).toBe(1)
    expect(again.evaluation.ok).toBe(true)
    expect(again.redemptionId).toBe(1)
    expect(redemptions).toHaveLength(1)
  })

  it("enforces max_per_user and max_redemptions from inside the lock", async () => {
    const { db, redemptions } = memoryDb()
    const repo = new PromoCodeRepository(db)
    await repo.reserve(reserveInput(501, "one@exp.test"))

    const sameUser = await repo.reserve(reserveInput(502, "ONE@exp.test"))
    expect(sameUser.evaluation).toMatchObject({ ok: false, reason: "ALREADY_USED" })

    await repo.reserve(reserveInput(503, "two@exp.test"))
    const overCap = await repo.reserve(reserveInput(504, "three@exp.test"))
    expect(overCap.evaluation).toMatchObject({ ok: false, reason: "EXHAUSTED" })
    expect(overCap.redemptionId).toBeNull()
    expect(redemptions).toHaveLength(2)
  })

  it("stops counting a voided redemption", async () => {
    const { db } = memoryDb()
    const repo = new PromoCodeRepository(db)
    const first = await repo.reserve(reserveInput(501, "one@exp.test"))
    await repo.voidRedemption(first.redemptionId!)
    const retry = await repo.reserve(reserveInput(502, "one@exp.test"))
    expect(retry.evaluation.ok).toBe(true)
  })

  it("answers NOT_FOUND for an unknown code without writing", async () => {
    const { db, redemptions } = memoryDb()
    const repo = new PromoCodeRepository(db)
    const result = await repo.reserve({ ...reserveInput(501, "one@exp.test"), code: "NOPE" })
    expect(result.evaluation).toMatchObject({ ok: false, reason: "NOT_FOUND" })
    expect(redemptions).toHaveLength(0)
  })
})
