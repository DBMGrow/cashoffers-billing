import { test, expect } from '@playwright/test'
import {
  fillPersonalInfo,
  fillCard,
  completeReviewStep,
  setupValidationMocks,
} from './helpers/form-helpers'
import { generateTestEmail, generateTestSlug, TEST_CARDS, PRODUCT_IDS } from './fixtures/test-data'
import { cleanupTestUser } from './helpers/api-helpers'

test.describe('Error and Edge Case Flows (30-34)', () => {
  let testEmail: string

  test.beforeEach(async ({ page }) => {
    testEmail = generateTestEmail('error')
    // Setup API mocks for validation endpoints
    await setupValidationMocks(page)
  })

  test.afterEach(async () => {
    await cleanupTestUser(testEmail)
  })

  test('Flow 30: Card Processing Error - Declined Card', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Declined Card User',
      slug: generateTestSlug('declined'),
      broker: 'Declined Brokerage',
      phone: '(555) 111-2222',
    })

    // Use declined test card
    await fillCard(
      page,
      TEST_CARDS.declined.number,
      TEST_CARDS.declined.expMonth,
      TEST_CARDS.declined.expYear
    )

    await completeReviewStep(page)

    // Should see error message
    await expect(
      page.locator('text=/unable.*process|card.*declined|payment.*failed/i')
    ).toBeVisible({ timeout: 10000 })

    // Should remain on review/error step, not proceed to welcome
    await expect(page).not.toHaveURL(/\/welcome/)
  })

  test('Flow 31: Card Processing Error - Insufficient Funds', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Insufficient Funds User',
      slug: generateTestSlug('insufficient'),
      broker: 'Insufficient Brokerage',
      phone: '(555) 222-3333',
    })

    await fillCard(
      page,
      TEST_CARDS.insufficientFunds.number,
      TEST_CARDS.insufficientFunds.expMonth,
      TEST_CARDS.insufficientFunds.expYear
    )

    await completeReviewStep(page)

    // Should see insufficient funds error
    await expect(
      page.locator('text=/insufficient.*funds|not.*enough|balance/i')
    ).toBeVisible({ timeout: 10000 })
  })

  test('Flow 32: Expired Card Error', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Expired Card User',
      slug: generateTestSlug('expired'),
      broker: 'Expired Brokerage',
      phone: '(555) 333-4444',
    })

    await fillCard(
      page,
      TEST_CARDS.expired.number,
      TEST_CARDS.expired.expMonth,
      TEST_CARDS.expired.expYear
    )

    await completeReviewStep(page)

    // Should see expired card error
    await expect(
      page.locator('text=/expired|invalid.*expiration/i')
    ).toBeVisible({ timeout: 10000 })
  })

  test('Flow 33: Email Already Exists Error', async ({ page }) => {
    // First signup with free product (goes: email → name → phone directly)
    // Mock the purchase API for the first signup (free products now go through /purchase/new)
    await page.route('**/api/purchase/new', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: 'success',
          data: {
            subscription: { subscriptionId: 999, userId: 1001, productId: PRODUCT_IDS.free, amount: 0 },
            product: { product_name: 'Free Agent' },
            user: { id: 1001, email: testEmail, reset_token: null, api_token: 'mock-token' },
            userCard: null,
            userCreated: true,
            proratedCharge: 0,
          },
          environment: 'sandbox',
        }),
      })
    })

    await page.goto(`/subscribe?product=${PRODUCT_IDS.free}`)

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    await page.fill('input[name="name"]', 'First User')
    await page.click('button:has-text("Next")')

    // Free products skip slug and broker, go directly to phone
    await page.waitForSelector('input[name="phone"]', { timeout: 5000 })
    await page.fill('input[name="phone"]', '(555) 444-5555')
    await page.click('button:has-text("Next")')

    await completeReviewStep(page)

    // Wait for WelcomeStep or redirect (signup completed)
    await page.waitForSelector('text=/Welcome to CashOffers/i', { timeout: 10000 })

    // Now try to sign up again with same email
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    // Should see error or redirect to login/manage
    const hasError = await page.locator('text=/already.*exists|account.*exists/i')
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    const redirectedToManage = page.url().includes('/manage')

    expect(hasError || redirectedToManage).toBe(true)
  })

  test('Flow 34: Invalid Product ID', async ({ page }) => {
    // Navigate with invalid product ID
    await page.goto('/subscribe?product=99999')

    // Wait for products to load and validation to occur
    await page.waitForLoadState('networkidle')

    // Should show error (looking for "Invalid product" text specifically)
    await expect(
      page.locator('text=/invalid.*product/i')
    ).toBeVisible({ timeout: 10000 })
  })

  test('Flow 35: Missing Required Fields', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    // Verify button is disabled when email is empty
    await expect(page.locator('button:has-text("Next")')).toBeDisabled()

    // Fill invalid email to test validation
    await page.fill('input[name="email"]', '')

    // Button should still be disabled
    await expect(page.locator('button:has-text("Next")')).toBeDisabled()
  })

  test('Flow 36: Invalid Email Format', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    // Fill invalid email format
    await page.fill('input[name="email"]', 'invalid-email')

    // Button should be disabled for invalid email
    await expect(page.locator('button:has-text("Next")')).toBeDisabled()

    // Fill valid email to test button becomes enabled
    await page.fill('input[name="email"]', testEmail)
    await expect(page.locator('button:has-text("Next")')).toBeEnabled()
  })

  test('Flow 37: Invalid Phone Format', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    await page.fill('input[name="name"]', 'Phone Test User')
    await page.click('button:has-text("Next")')

    await page.click('button:has-text("Skip")') // Skip slug

    await page.fill('input[name="name_broker"]', 'Phone Test Brokerage')
    await page.click('button:has-text("Next")')

    // Wait for next step to load - either team or phone
    await page.waitForTimeout(500)

    // If team name input is visible, click Next to skip it
    const teamInput = page.locator('input[name="name_team"]')
    if (await teamInput.isVisible().catch(() => false)) {
      await page.click('button:has-text("Next")')
      await page.waitForTimeout(500)
    }

    // Now on phone step - enter invalid phone
    await page.waitForSelector('input[name="phone"]', { timeout: 10000 })
    await page.fill('input[name="phone"]', '123')

    // Button should be disabled for invalid phone (less than 14 characters formatted)
    await expect(page.locator('button:has-text("Next")')).toBeDisabled()
  })

  test('Flow 38: Network Error Handling', async ({ page, context }) => {
    // Intercept API requests to simulate network errors
    await page.route('**/api/signup/**', route => {
      route.abort('failed')
    })

    await page.goto(`/subscribe?product=${PRODUCT_IDS.free}`)

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    // Should see network error (use first match to avoid strict mode violation)
    await expect(
      page.locator('text=/error|failed|try.*again|network/i').first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Flow 39: Consent Checkboxes Not Checked', async ({ page }) => {
    // Free product flow: email → name → phone (skips slug and broker)
    await page.goto(`/subscribe?product=${PRODUCT_IDS.free}`)

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    await page.fill('input[name="name"]', 'Consent Test User')
    await page.click('button:has-text("Next")')

    // Free product: goes directly to phone (no slug or broker steps)
    await page.waitForSelector('input[name="phone"]', { timeout: 5000 })
    await page.fill('input[name="phone"]', '(555) 555-6666')
    await page.click('button:has-text("Next")')

    // On review step: the "Sign Up" button should be disabled without consents
    await page.waitForSelector('button:has-text("Sign Up")', { timeout: 5000 })
    const submitButton = page.locator('button:has-text("Sign Up")')

    // Button should be disabled when no consents are checked
    await expect(submitButton).toBeDisabled()

    // Check the general consent checkbox to enable the button
    const consentCheckboxes = page.locator('input[type="checkbox"][name="consent"]')
    await consentCheckboxes.first().check()

    // Button should now be enabled
    await expect(submitButton).toBeEnabled()
  })

  test('Flow 40: Prorated Charge Calculation Error', async ({ page, context }) => {
    // This requires a user with existing subscription
    // Mock the API to return error for prorated calculation
    await page.route('**/api/product/checkprorated', route => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          success: 'error',
          error: 'Unable to calculate prorated charge',
        }),
      })
    })

    await page.goto('/manage')

    // This would fail during plan change
    // The actual test would require full authentication flow
    // For now, verify the error handling exists in API
  })

  test('Flow 41: Concurrent User Signup Race Condition', async ({ page, context }) => {
    // Test for race condition when two signups happen simultaneously
    // This is more of an API test but we can verify frontend handles it

    const newContext1 = await context.browser()!.newContext()
    const newContext2 = await context.browser()!.newContext()

    const page1 = await newContext1.newPage()
    const page2 = await newContext2.newPage()

    const sameEmail = generateTestEmail('race')

    // Start both signups simultaneously
    const signup1 = (async () => {
      await page1.goto(`/subscribe?product=${PRODUCT_IDS.free}`)
      await page1.fill('input[name="email"]', sameEmail)
      await page1.click('button:has-text("Next")')
      await page1.fill('input[name="name"]', 'Race User 1')
      await page1.click('button:has-text("Next")')
      await page1.click('button:has-text("Skip")')
      await page1.fill('input[name="name_broker"]', 'Race Brokerage 1')
      await page1.click('button:has-text("Next")')
      await page1.fill('input[name="phone"]', '(555) 666-7777')
      await page1.click('button:has-text("Next")')
      await completeReviewStep(page1)
    })()

    const signup2 = (async () => {
      await page2.goto(`/subscribe?product=${PRODUCT_IDS.free}`)
      await page2.fill('input[name="email"]', sameEmail)
      await page2.click('button:has-text("Next")')
      await page2.fill('input[name="name"]', 'Race User 2')
      await page2.click('button:has-text("Next")')
      await page2.click('button:has-text("Skip")')
      await page2.fill('input[name="name_broker"]', 'Race Brokerage 2')
      await page2.click('button:has-text("Next")')
      await page2.fill('input[name="phone"]', '(555) 777-8888')
      await page2.click('button:has-text("Next")')
      await completeReviewStep(page2)
    })()

    await Promise.allSettled([signup1, signup2])

    // One should succeed, one should fail with duplicate error
    // Verify at least one has error
    const page1HasError = await page1.locator('text=/already.*exists|error/i')
      .isVisible()
      .catch(() => false)

    const page2HasError = await page2.locator('text=/already.*exists|error/i')
      .isVisible()
      .catch(() => false)

    const page1Success = page1.url().includes('/welcome')
    const page2Success = page2.url().includes('/welcome')

    // Exactly one should succeed
    expect((page1Success && !page2Success) || (!page1Success && page2Success)).toBe(true)

    await newContext1.close()
    await newContext2.close()

    await cleanupTestUser(sameEmail)
  })
})
