"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Subscriptions", "next_renewal_attempt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "The date and time when the next renewal attempt should occur after a failed payment",
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Subscriptions", "next_renewal_attempt")
  },
}
