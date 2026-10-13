import { test, expect, Page } from "@playwright/test"
import {
  fillEmail,
  fillName,
  fillSlug,
  fillBroker,
  fillTeamName,
  fillLocation,
  fillPhone,
  setupValidationMocks,
  setupPurchaseMocks,
} from "./helpers/form-helpers"
import { generateTestEmail, generateTestSlug } from "./fixtures/test-data"

/**
 * Free trial signup (Desk #1350, plan AC7). The product list is mocked with a trial product, so
 * this runs against any database: nothing is purchased (the purchase is mocked too).
 */

const TRIAL_PRODUCT_ID = 70

async function mockTrialProduct(page: Page) {
  await page.route("**/api/signup/products**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: "success",
        data: [
          {
            product_id: TRIAL_PRODUCT_ID,
            product_name: "InstantOffers365 Individual",
            product_description: null,
            product_type: "subscription",
            price: 0,
            active: 1,
            data: {
              renewal_cost: 25000,
              signup_fee: 0,
              duration: "monthly",
              trial: { enabled: true, duration_days: 30, require_card: true },
            },
          },
        ],
      }),
    })
  )
}

/** Email to phone for an agent plan, each step driven in turn (no optional-step guessing). */
async function fillAgentSteps(page: Page) {
  await fillEmail(page, generateTestEmail())
  await fillName(page, "Pat Agent")
  await fillSlug(page, generateTestSlug("patagent"))
  await fillBroker(page, "Test Brokerage")
  await fillTeamName(page, "Test Team")
  await fillLocation(page)
  await fillPhone(page, "(555) 123-4567")
}

function firstChargeDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
}

test.describe("Free trial signup", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    await setupValidationMocks(page)
    await setupPurchaseMocks(page)
    await mockTrialProduct(page)
  })

  test("asks for a card and says when it is first charged", async ({ page }) => {
    await page.goto(`/default/subscribe/${TRIAL_PRODUCT_ID}`)

    await fillAgentSteps(page)

    await expect(page.getByText("What Card would you like to use?")).toBeVisible()
    await expect(page.getByText("You won't be charged until your 30-day trial ends.")).toBeVisible()
  })

  test("375px review step", async ({ page }) => {
    // mock_purchase skips the card step (a Square iframe) and reaches review
    await page.goto(`/default/subscribe/${TRIAL_PRODUCT_ID}?mock_purchase=true`)

    await fillAgentSteps(page)

    // Let the step's title and slide-in animation finish before measuring
    await expect(page.getByRole("heading", { name: "Review." })).toBeVisible()
    await page.waitForTimeout(1000)

    const dueToday = page.getByText("Due today").locator("..")
    await expect(dueToday).toContainText("$0")
    await expect(page.getByText("Total Today")).toHaveCount(0)
    const then = page.getByTestId("trial-first-charge")
    await expect(then).toContainText("Then")
    await expect(then).toContainText(`$250/mo starting ${firstChargeDate()}`)

    // The two lines stack at 375px: the value sits below its label, not beside it
    const label = await then.locator("strong").boundingBox()
    const value = await then.locator("div").boundingBox()
    expect(label && value && value.y >= label.y + label.height - 1).toBe(true)

    // Nothing scrolls sideways, and nothing the agent must read is cut off at the edge
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)
    const signUp = await page.getByRole("button", { name: "Sign Up" }).boundingBox()
    for (const box of [await dueToday.locator(".text-price").boundingBox(), value, signUp]) {
      expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true)
    }
  })
})
