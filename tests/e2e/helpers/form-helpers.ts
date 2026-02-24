import { Page } from '@playwright/test'

/**
 * Setup API mocks for validation endpoints
 * Call this before starting any signup flow
 */
export async function setupValidationMocks(page: Page) {
  // Mock slug validation - always return slug is available
  await page.route('**/api/signup/checkslugexists/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: 'success',
        userExists: false,
      }),
    })
  })

  // Mock user exists check - always return user doesn't exist
  await page.route('**/api/signup/checkuserexists/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: 'success',
        userExists: false,
        offerDowngrade: false,
      }),
    })
  })
}

/**
 * Fill email input
 */
export async function fillEmail(page: Page, email: string) {
  await page.fill('input[name="email"]', email)
  // Wait for button to be enabled and click with retry logic
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  // Wait for navigation to complete
  await page.waitForTimeout(500)
}

/**
 * Fill name input
 */
export async function fillName(page: Page, name: string) {
  await page.fill('input[name="name"]', name)
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  await page.waitForTimeout(500)
}

/**
 * Fill slug input
 */
export async function fillSlug(page: Page, slug: string) {
  await page.fill('input[name="slug"]', slug)
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  await page.waitForTimeout(500)
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
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  await page.waitForTimeout(500)
}

/**
 * Fill team name (optional step)
 */
export async function fillTeamName(page: Page, teamName: string) {
  await page.fill('input[name="name_team"]', teamName)
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  await page.waitForTimeout(500)
}

/**
 * Fill phone number
 */
export async function fillPhone(page: Page, phone: string) {
  await page.fill('input[name="phone"]', phone)
  const nextButton = page.getByTestId('next-button')
  await nextButton.waitFor({ state: 'visible', timeout: 5000 })
  await nextButton.click({ timeout: 10000 })
  await page.waitForTimeout(500)
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

  await page.waitForSelector('button:has-text("Next"):not([disabled])', { timeout: 5000 })
  await page.click('button:has-text("Next")')
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

  // Check if team name step exists (optional step for some products)
  const hasTeamStep = await page.locator('input[name="name_team"]').isVisible({ timeout: 2000 }).catch(() => false)
  if (hasTeamStep) {
    if (data.teamName) {
      await fillTeamName(page, data.teamName)
    } else {
      // Just click Next to skip optional team name
      await page.click('button:has-text("Next")')
    }
  }

  await fillPhone(page, data.phone)
}

/**
 * Complete review step with consents
 */
export async function completeReviewStep(page: Page) {
  // Check both consent checkboxes (they both have name="consent")
  // We need to get all checkboxes and check each one
  const checkboxes = await page.locator('input[type="checkbox"][name="consent"]').all()
  for (const checkbox of checkboxes) {
    await checkbox.check()
  }

  // Wait a moment for state to update
  await page.waitForTimeout(500)

  // Submit - button text is "Sign Up", not "Complete Sign Up"
  await page.click('button:has-text("Sign Up"):not([disabled])')
}

/**
 * Wait for welcome message after successful signup
 * The app shows a welcome message before redirecting to the dashboard
 */
export async function waitForWelcome(page: Page) {
  // Wait for the welcome message to appear
  await page.waitForSelector('text=/Welcome to CashOffers\\.PRO/i', { timeout: 30000 })
}
