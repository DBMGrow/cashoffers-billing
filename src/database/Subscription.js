import { DataTypes } from "sequelize"
import sequelize from "./database"

export const Subscription = sequelize.define("Subscription", {
  subscription_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  subscription_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  duration: {
    type: DataTypes.ENUM,
    allowNull: false,
    values: ["daily", "weekly", "monthly", "yearly"],
  },
  renewal_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  meta: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  next_renewal_attempt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "The date and time when the next renewal attempt should occur after a failed payment",
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    allowNull: true,
    references: {
      model: "Products",
      key: "product_id",
    },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  cancel_on_renewal: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
})
