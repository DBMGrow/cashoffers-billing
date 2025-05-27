import { DB } from "./db.d"
import { Kysely, MysqlDialect } from "kysely"
import { createPool } from "mysql2"

const dialect = new MysqlDialect({
  pool: createPool({
    database: process.env.DB_NAME!,
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    port: Number(process.env.DB_PORT || "3306") ?? 3306,
    connectionLimit: 10,
  }),
})

export const db = new Kysely<DB>({
  dialect,
})
