import { Kysely, Selectable, Insertable, Updateable } from "kysely"
import type { DB, BillingLogs } from "@api/lib/db"

/**
 * Billing Log Repository Implementation
 * Handles log persistence using Kysely with bulk insert support
 */
export class BillingLogRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<BillingLogs> | null> {
    const result = await this.db
      .selectFrom("BillingLogs")
      .where("log_id", "=", Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findAll(criteria?: Partial<Selectable<BillingLogs>>): Promise<Selectable<BillingLogs>[]> {
    let query = this.db.selectFrom("BillingLogs").selectAll()

    if (criteria) {
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.where(key as any, "=", value)
        }
      })
    }

    return await query.execute()
  }

  async findOne(criteria: Partial<Selectable<BillingLogs>>): Promise<Selectable<BillingLogs> | null> {
    let query = this.db.selectFrom("BillingLogs").selectAll()

    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined) {
        query = query.where(key as any, "=", value)
      }
    })

    const result = await query.executeTakeFirst()
    return result || null
  }

  async create(data: Insertable<BillingLogs>): Promise<Selectable<BillingLogs>> {
    const result = await this.db.insertInto("BillingLogs").values(data).executeTakeFirstOrThrow()

    // Fetch the created record
    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error("Failed to retrieve created billing log")
    }

    return created
  }

  async update(id: number | bigint, data: Updateable<BillingLogs>): Promise<Selectable<BillingLogs>> {
    await this.db.updateTable("BillingLogs").set(data).where("log_id", "=", Number(id)).executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error("Failed to retrieve updated billing log")
    }

    return updated
  }

  async delete(id: number | bigint): Promise<void> {
    await this.db.deleteFrom("BillingLogs").where("log_id", "=", Number(id)).executeTakeFirstOrThrow()
  }

  // Custom methods specific to BillingLogRepository

  /**
   * Bulk insert multiple log entries
   * Critical for performance when flushing queued logs
   */
  async createMany(logs: Insertable<BillingLogs>[]): Promise<void> {
    if (logs.length === 0) {
      return
    }

    // Kysely handles bulk inserts efficiently with a single SQL query
    await this.db.insertInto("BillingLogs").values(logs).execute()
  }

  async findByRequestId(requestId: string): Promise<Selectable<BillingLogs>[]> {
    return await this.db
      .selectFrom("BillingLogs")
      .where("request_id", "=", requestId)
      .selectAll()
      .orderBy("createdAt", "asc")
      .execute()
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    filters?: {
      level?: "debug" | "info" | "warn" | "error"
      context_type?: "http_request" | "cron_job" | "event_handler" | "background"
      user_id?: number
      component?: string
    }
  ): Promise<Selectable<BillingLogs>[]> {
    let query = this.db
      .selectFrom("BillingLogs")
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .selectAll()
      .orderBy("createdAt", "desc")

    if (filters?.level) {
      query = query.where("level", "=", filters.level)
    }

    if (filters?.context_type) {
      query = query.where("context_type", "=", filters.context_type)
    }

    if (filters?.user_id !== undefined) {
      query = query.where("user_id", "=", filters.user_id)
    }

    if (filters?.component) {
      query = query.where("component", "=", filters.component)
    }

    return await query.execute()
  }

  async findByComponent(component: string, limit = 100): Promise<Selectable<BillingLogs>[]> {
    return await this.db
      .selectFrom("BillingLogs")
      .where("component", "=", component)
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .execute()
  }

  async findByUserId(userId: number, limit = 100): Promise<Selectable<BillingLogs>[]> {
    return await this.db
      .selectFrom("BillingLogs")
      .where("user_id", "=", userId)
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .execute()
  }

  async findByLevel(level: "debug" | "info" | "warn" | "error", limit = 100): Promise<Selectable<BillingLogs>[]> {
    return await this.db
      .selectFrom("BillingLogs")
      .where("level", "=", level)
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .execute()
  }
}

/**
 * Create a billing log repository
 */
export const createBillingLogRepository = (db: Kysely<DB>): BillingLogRepository => {
  return new BillingLogRepository(db)
}
