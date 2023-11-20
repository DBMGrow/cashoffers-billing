"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Subscriptions", "suspension_date", {
      type: Sequelize.DATE,
      allowNull: true,
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Subscriptions", "suspension_date")
  },
}
