import { DB } from "@api/lib/db"
import { Kysely, MysqlDialect } from "kysely"
import type { MysqlPool } from "kysely"
import { createPool } from "mysql2"
import type { IConfig } from "@api/config/config.interface"

/**
 * Create a Kysely database instance
 */
export const createKyselyDatabase = (config: IConfig): Kysely<DB> => {
  const pool = createPool({
    database: config.database.name,
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    port: config.database.port,
    connectionLimit: 10,
  })

  const dialect = new MysqlDialect({ pool: pool as unknown as MysqlPool })

  return new Kysely<DB>({ dialect })
}

/**
 * Create a test Kysely database instance (for testing)
 */
export const createTestKyselyDatabase = (
  testConfig: Pick<IConfig["database"], "name" | "host" | "user" | "password" | "port">
): Kysely<DB> => {
  const testPool = createPool({
    database: testConfig.name,
    host: testConfig.host,
    user: testConfig.user,
    password: testConfig.password,
    port: testConfig.port,
    connectionLimit: 10,
  })

  const dialect = new MysqlDialect({ pool: testPool as unknown as MysqlPool })

  return new Kysely<DB>({ dialect })
}

/**
 * Close database connection
 */
export const closeDatabase = async (db: Kysely<DB>): Promise<void> => {
  await db.destroy()
}
