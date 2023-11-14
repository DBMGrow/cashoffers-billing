"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove 'notification_email' from 'Subscriptions' table
    await queryInterface.removeColumn("Subscriptions", "notification_email")

    // Remove 'notification_email' from 'UserCards' table
    await queryInterface.removeColumn("UserCards", "notification_email")
  },

  async down(queryInterface, Sequelize) {
    // Add 'notification_email' back to 'Subscriptions' table
    await queryInterface.addColumn("Subscriptions", "notification_email", {
      type: Sequelize.STRING,
      allowNull: true,
    })

    // Add 'notification_email' back to 'UserCards' table
    await queryInterface.addColumn("UserCards", "notification_email", {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },
}
