"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Transactions", "square_transaction_id", {
      type: Sequelize.STRING,
      allowNull: true,
    })

    await queryInterface.addColumn("Transactions", "status", {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Transactions", "square_transaction_id")
    await queryInterface.removeColumn("Transactions", "status")
  },
}
