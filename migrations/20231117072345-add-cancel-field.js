"use strict"

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Subscriptions", "cancel_on_renewal", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("Subscriptions", "cancel_on_renewal")
  },
}
