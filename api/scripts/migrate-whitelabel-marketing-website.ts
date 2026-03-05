/**
 * Migration Script: Add marketing_website to Whitelabels
 *
 * This script updates all whitelabels in the database with marketing_website data.
 * Customize the whitelabelMappings below with your actual whitelabel URLs.
 *
 * Usage: npx tsx api/scripts/migrate-whitelabel-marketing-website.ts
 */

import { db } from "@api/lib/database"
import { WhitelabelData } from "@api/domain/types/whitelabel-data.types"

interface WhitelabelMapping {
  code: string
  marketingWebsite: string
}

// Map whitelabel codes to their marketing website URLs
// Customize this based on your actual whitelabels
const whitelabelMappings: WhitelabelMapping[] = [
  {
    code: "default",
    marketingWebsite: "https://cashoffers.com",
  },
  {
    code: "youwhitelabel",
    marketingWebsite: "https://youwhitelabel.com",
  },
  // Add more whitelabels as needed
]

async function migrateWhitelabelMarketing() {
  try {
    console.log("🚀 Starting whitelabel marketing_website migration...")

    // Get all whitelabels
    const whitelabels = await db.selectFrom("Whitelabels").selectAll().execute()

    if (whitelabels.length === 0) {
      console.log("ℹ️  No whitelabels found in database")
      return
    }

    console.log(`📦 Found ${whitelabels.length} whitelabels`)

    let updatedCount = 0
    let skippedCount = 0

    for (const whitelabel of whitelabels) {
      const code = whitelabel.code
      const existingData = (whitelabel.data as any) || {}

      // If marketing_website already exists, skip
      if (existingData.marketing_website) {
        console.log(`⏭️  Skipping "${code}" - already has marketing_website`)
        skippedCount++
        continue
      }

      // Find matching mapping
      const mapping = whitelabelMappings.find((m) => m.code === code)

      if (!mapping) {
        console.log(
          `⚠️  No marketing_website mapping found for "${code}" - using default (https://cashoffers.com)`
        )
        // For unmapped whitelabels, use a default URL based on code
        const defaultUrl = code === "default" ? "https://cashoffers.com" : `https://${code}.cashoffers.com`

        const updatedData: WhitelabelData = {
          ...existingData,
          marketing_website: defaultUrl,
        }

        await db
          .updateTable("Whitelabels")
          .set({
            data: JSON.stringify(updatedData),
          })
          .where("whitelabel_id", "=", whitelabel.whitelabel_id)
          .execute()

        console.log(`✅ Updated "${code}" with default marketing_website: ${defaultUrl}`)
        updatedCount++
        continue
      }

      // Update whitelabel with marketing_website
      const updatedData: WhitelabelData = {
        ...existingData,
        marketing_website: mapping.marketingWebsite,
      }

      await db
        .updateTable("Whitelabels")
        .set({
          data: JSON.stringify(updatedData),
        })
        .where("whitelabel_id", "=", whitelabel.whitelabel_id)
        .execute()

      console.log(`✅ Updated "${code}" with marketing_website: ${mapping.marketingWebsite}`)
      updatedCount++
    }

    console.log(
      `\n📊 Migration complete: ${updatedCount} updated, ${skippedCount} skipped out of ${whitelabels.length} total`
    )
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

migrateWhitelabelMarketing().then(() => {
  console.log("✨ Done!")
  process.exit(0)
})
