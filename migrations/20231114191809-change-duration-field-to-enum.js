"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    // Update field type to varchar
    await queryInterface.changeColumn("Subscriptions", "duration", {
      type: Sequelize.STRING,
      allowNull: false,
    })

    // Update all existing records to 'monthly'
    await queryInterface.sequelize.query(`UPDATE "Subscriptions" SET duration = 'monthly'`)

    // Change 'duration' column type to ENUM with desired values
    await queryInterface.changeColumn("Subscriptions", "duration", {
      type: Sequelize.ENUM("daily", "weekly", "monthly", "yearly"),
      allowNull: false,
    })
  },

  async down(queryInterface, Sequelize) {
    // Code to revert the column type change if needed
    await queryInterface.changeColumn("Subscriptions", "duration", {
      type: Sequelize.INTEGER,
      allowNull: false,
    })
  },
}
