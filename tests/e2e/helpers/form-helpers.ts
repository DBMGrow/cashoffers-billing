import { Page } from '@playwright/test'

/**
 * Fill email input
 */
export async function fillEmail(page: Page, email: string) {
  await page.fill('input[name="email"]', email)
  await page.click('button:has-text("Continue")')
}

/**
 * Fill name input
 */
export async function fillName(page: Page, name: string) {
  await page.fill('input[name="name"]', name)
  await page.click('button:has-text("Continue")')
}

/**
 * Fill slug input
 */
export async function fillSlug(page: Page, slug: string) {
  await page.fill('input[name="slug"]', slug)
  await page.click('button:has-text("Continue")')
}

/**
 * Skip slug step
 */
export async function skipSlug(page: Page) {
  await page.click('button:has-text("Skip")')
}

/**
 * Fill brokerage name
 */
export async function fillBroker(page: Page, brokerName: string) {
  await page.fill('input[name="name_broker"]', brokerName)
  await page.click('button:has-text("Continue")')
}

/**
 * Fill team name (optional step)
 */
export async function fillTeamName(page: Page, teamName: string) {
  await page.fill('input[name="name_team"]', teamName)
  await page.click('button:has-text("Continue")')
}

/**
 * Fill phone number
 */
export async function fillPhone(page: Page, phone: string) {
  await page.fill('input[name="phone"]', phone)
  await page.click('button:has-text("Continue")')
}

/**
 * Fill credit card details using Square payment form
 * Note: This may need adjustment based on actual Square iframe implementation
 */
export async function fillCard(
  page: Page,
  cardNumber: string,
  expMonth: string,
  expYear: string,
  cvv: string = '123'
) {
  // Wait for Square payment form to load
  await page.waitForSelector('#card-container', { timeout: 10000 })

  // Square uses iframes, so we need to handle that
  // This is a simplified version - may need adjustment based on actual implementation
  const cardFrame = page.frameLocator('iframe[name*="card-number"]')
  await cardFrame.locator('input').fill(cardNumber)

  const expFrame = page.frameLocator('iframe[name*="expiration"]')
  await expFrame.locator('input').fill(`${expMonth}${expYear}`)

  const cvvFrame = page.frameLocator('iframe[name*="cvv"]')
  await cvvFrame.locator('input').fill(cvv)

  await page.click('button:has-text("Continue")')
}

/**
 * Fill all personal information for standard signup
 */
export async function fillPersonalInfo(page: Page, data: {
  email: string
  name: string
  slug?: string
  broker: string
  teamName?: string
  phone: string
}) {
  await fillEmail(page, data.email)
  await fillName(page, data.name)

  if (data.slug) {
    await fillSlug(page, data.slug)
  } else {
    await skipSlug(page)
  }

  await fillBroker(page, data.broker)

  if (data.teamName) {
    await fillTeamName(page, data.teamName)
  }

  await fillPhone(page, data.phone)
}

/**
 * Complete review step with consents
 */
export async function completeReviewStep(page: Page) {
  // Check consent checkboxes
  await page.check('input[name="general_consent"]')
  await page.check('input[name="communication_consent"]')

  // Submit
  await page.click('button:has-text("Complete Sign Up")')
}

/**
 * Wait for welcome page after successful signup
 */
export async function waitForWelcome(page: Page) {
  await page.waitForURL(/\/welcome/, { timeout: 30000 })
}
