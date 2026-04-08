/**
 * Migration Script: Add user_config to all products
 *
 * This script updates all products in the database with proper user_config data.
 * It maps existing products to appropriate user configurations based on product name/type.
 *
 * Usage: npx tsx api/scripts/migrate-product-user-config.ts
 */

import { db } from "@api/lib/database"
import { ProductData } from "@api/domain/types/product-data.types"

interface ProductMapping {
  productName: string
  isPremium: 0 | 1
  role: "AGENT" | "INVESTOR" | "ADMIN" | "TEAMOWNER"
  whitelabelId: number | null
  isTeamPlan: boolean
}

// Default product mappings - customize based on your actual products
const productMappings: ProductMapping[] = [
  {
    productName: "Free",
    isPremium: 0,
    role: "AGENT",
    whitelabelId: 4,
    isTeamPlan: false,
  },
  {
    productName: "Free Investor",
    isPremium: 0,
    role: "INVESTOR",
    whitelabelId: 4,
    isTeamPlan: false,
  },
  {
    productName: "Premium Monthly",
    isPremium: 1,
    role: "AGENT",
    whitelabelId: 4,
    isTeamPlan: false,
  },
  {
    productName: "Team Plan",
    isPremium: 1,
    role: "TEAMOWNER",
    whitelabelId: 4,
    isTeamPlan: true,
  },
  {
    productName: "Investor Monthly",
    isPremium: 1,
    role: "INVESTOR",
    whitelabelId: 4,
    isTeamPlan: false,
  },
]

async function migrateProductUserConfig() {
  try {
    console.log("🚀 Starting product user_config migration...")

    // Get all products
    const products = await db.selectFrom("Products").selectAll().execute()

    if (products.length === 0) {
      console.log("ℹ️  No products found in database")
      return
    }

    console.log(`📦 Found ${products.length} products`)

    let updatedCount = 0
    let skippedCount = 0

    for (const product of products) {
      const productName = product.product_name
      const existingData = (product.data as any) || {}

      // If user_config already exists, skip
      if (existingData.user_config) {
        console.log(`⏭️  Skipping "${productName}" - already has user_config`)
        skippedCount++
        continue
      }

      // Find matching mapping
      const mapping = productMappings.find((m) =>
        productName.toLowerCase().includes(m.productName.toLowerCase())
      )

      if (!mapping) {
        console.log(`⚠️  No mapping found for "${productName}" - skipping`)
        skippedCount++
        continue
      }

      // Update product with user_config
      const updatedData: ProductData = {
        ...existingData,
        user_config: {
          is_premium: mapping.isPremium,
          role: mapping.role,
          whitelabel_id: mapping.whitelabelId,
          is_team_plan: mapping.isTeamPlan,
        },
      }

      await db
        .updateTable("Products")
        .set({
          data: JSON.stringify(updatedData),
        })
        .where("product_id", "=", product.product_id)
        .execute()

      console.log(
        `✅ Updated "${productName}" with config: ${mapping.role} (Premium: ${mapping.isPremium}, Team: ${mapping.isTeamPlan})`
      )
      updatedCount++
    }

    console.log(
      `\n📊 Migration complete: ${updatedCount} updated, ${skippedCount} skipped out of ${products.length} total`
    )
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

migrateProductUserConfig().then(() => {
  console.log("✨ Done!")
  process.exit(0)
})
