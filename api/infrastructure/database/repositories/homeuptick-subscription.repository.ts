import { Kysely, Selectable, Insertable, Updateable } from "kysely"
import type { DB, HomeuptickSubscriptions } from "@api/lib/db"

/**
 * HomeUptick Subscription Repository
 * Manages Homeuptick_Subscriptions rows — the live source of truth for HU config per user.
 */
export class HomeUptickSubscriptionRepository {
  constructor(private db: Kysely<DB>) {}

  async findById(id: number | bigint): Promise<Selectable<HomeuptickSubscriptions> | null> {
    const result = await this.db
      .selectFrom("Homeuptick_Subscriptions")
      .where("homeuptick_id", "=", Number(id))
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async findByUserId(userId: number): Promise<Selectable<HomeuptickSubscriptions>[]> {
    return await this.db
      .selectFrom("Homeuptick_Subscriptions")
      .where("user_id", "=", userId)
      .selectAll()
      .execute()
  }

  async findActiveByUserId(userId: number): Promise<Selectable<HomeuptickSubscriptions> | null> {
    const result = await this.db
      .selectFrom("Homeuptick_Subscriptions")
      .where("user_id", "=", userId)
      .where("active", "=", 1)
      .selectAll()
      .executeTakeFirst()

    return result || null
  }

  async create(data: Insertable<HomeuptickSubscriptions>): Promise<Selectable<HomeuptickSubscriptions>> {
    const result = await this.db
      .insertInto("Homeuptick_Subscriptions")
      .values(data)
      .executeTakeFirstOrThrow()

    const created = await this.findById(Number(result.insertId))
    if (!created) {
      throw new Error("Failed to retrieve created HomeUptick subscription")
    }

    return created
  }

  async update(id: number | bigint, data: Updateable<HomeuptickSubscriptions>): Promise<Selectable<HomeuptickSubscriptions>> {
    await this.db
      .updateTable("Homeuptick_Subscriptions")
      .set(data)
      .where("homeuptick_id", "=", Number(id))
      .executeTakeFirstOrThrow()

    const updated = await this.findById(id)
    if (!updated) {
      throw new Error("Failed to retrieve updated HomeUptick subscription")
    }

    return updated
  }
}

export const createHomeUptickSubscriptionRepository = (db: Kysely<DB>): HomeUptickSubscriptionRepository => {
  return new HomeUptickSubscriptionRepository(db)
}
