import { DataTypes } from "sequelize"
import sequelize from "./database"

export const Product = sequelize.define("Product", {
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  product_description: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
  },
  product_type: {
    type: DataTypes.ENUM,
    allowNull: false,
    values: ["none", "subscription", "one-time"],
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
})
