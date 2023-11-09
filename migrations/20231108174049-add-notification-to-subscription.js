"use strict"

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "Subscriptions", // name of the Source model
      "notification_email", // name of the key we're adding
      {
        type: Sequelize.STRING,
        allowNull: true,
        after: "meta", // adjust 'existing_column' to the column after which you want the new column to be added
      }
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "Subscriptions", // name of the Source model
      "notification_email" // key we want to remove
    )
  },
}
