"use strict"

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "Subscriptions", // name of the table
      "product_id", // name of the new column
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Products", // name of the reference table
          key: "product_id", // key in the reference table
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      }
    )

    await queryInterface.addColumn(
      "Subscriptions", // name of the table
      "data", // name of the new column
      {
        type: Sequelize.JSON,
        allowNull: true,
      }
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Subscriptions", "product_id")
    await queryInterface.removeColumn("Subscriptions", "data")
  },
}
