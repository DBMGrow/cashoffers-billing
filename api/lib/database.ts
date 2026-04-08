import { DB } from "./db"
import { Kysely, MysqlDialect } from "kysely"
import { createPool } from "mysql2"
import { config } from "@api/config/config.service"

export const db = new Kysely<DB>({
  dialect: new MysqlDialect({
    pool: createPool({
      database: config.database.name,
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      port: config.database.port,
      connectionLimit: 10,
    }),
  }),
})
