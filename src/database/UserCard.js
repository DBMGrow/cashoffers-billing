import { DataTypes } from "sequelize"
import sequelize from "./database"

export const UserCard = sequelize.define("UserCard", {
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  card_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  last_4: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  card_brand: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exp_month: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exp_year: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cardholder_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  square_customer_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
})
