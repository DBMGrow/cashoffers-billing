import { Sequelize } from "sequelize"
import config from "../config/config.js"

const env = process.env.NODE_ENV || "development"
const db = config?.[env].database
const user = config?.[env].username
const password = config?.[env].password
const host = config?.[env].host
const port = config?.[env].port

const sequelize = new Sequelize(db, user, password, {
  host,
  port,
  dialect: "mysql",
  logging: false,
})

export default sequelize
