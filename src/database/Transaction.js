import { DataTypes } from "sequelize"
import sequelize from "./database"

export const Transaction = sequelize.define("Transaction", {
  transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "Products",
      key: "product_id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
  square_transaction_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
})
