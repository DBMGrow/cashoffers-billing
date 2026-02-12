import { DB } from '@api/lib/db'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import type { IConfig } from '@api/config/config.interface'

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

  const dialect = new MysqlDialect({ pool })

  return new Kysely<DB>({ dialect })
}

/**
 * Create a test Kysely database instance (for testing)
 */
export const createTestKyselyDatabase = (): Kysely<DB> => {
  // For testing, we'll create a minimal config
  const testPool = createPool({
    database: process.env.DB_NAME || 'test',
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'test',
    password: process.env.DB_PASSWORD || 'test',
    port: Number(process.env.DB_PORT || '3306'),
    connectionLimit: 10,
  })

  const dialect = new MysqlDialect({ pool: testPool })

  return new Kysely<DB>({ dialect })
}

/**
 * Close database connection
 */
export const closeDatabase = async (db: Kysely<DB>): Promise<void> => {
  await db.destroy()
}
