import { DataTypes } from "sequelize"
import sequelize from "./database"

export const Transaction = sequelize.define("Transaction", {
  transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  memo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  data: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
})
