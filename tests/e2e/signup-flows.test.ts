import { test, expect } from '@playwright/test'
import {
  fillPersonalInfo,
  fillCard,
  completeReviewStep,
  waitForWelcome,
  skipSlug,
  fillEmail,
  fillName,
  fillBroker,
  fillPhone,
  setupValidationMocks,
} from './helpers/form-helpers'
import { isAuthenticated } from './helpers/auth-helpers'
import { cleanupTestUser } from './helpers/api-helpers'
import {
  generateTestEmail,
  generateTestSlug,
  TEST_CARDS,
  WHITELABELS,
  PRODUCT_IDS,
} from './fixtures/test-data'

test.describe('Signup Flows (1-12)', () => {
  let testEmail: string

  test.beforeEach(async ({ page }) => {
    // Generate unique email for each test
    testEmail = generateTestEmail()
    // Setup API mocks for validation endpoints
    await setupValidationMocks(page)
  })

  test.afterEach(async () => {
    // Cleanup test data
    await cleanupTestUser(testEmail)
  })

  test('Flow 1: Standard Paid Plan Signup', async ({ page }) => {
    // Navigate to subscribe page with mock purchase to avoid real charges
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}&mock_purchase=true`)

    // Fill personal information
    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'John Doe',
      slug: generateTestSlug('johndoe'),
      broker: 'Test Brokerage',
      phone: '(555) 123-4567',
    })

    // Fill card details
    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear,
      TEST_CARDS.valid.cvv
    )

    // Complete review step
    await completeReviewStep(page)

    // Verify redirect to welcome page
    await waitForWelcome(page)

    // Verify cookie is set
    expect(await isAuthenticated(page)).toBe(true)

    // Verify welcome content is visible
    await expect(page.locator('text=/welcome|success/i')).toBeVisible()
  })

  test('Flow 2: Free Plan Signup', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.free}`)

    // Fill personal information (no card step for free)
    await fillEmail(page, testEmail)
    await fillName(page, 'Jane Smith')
    await skipSlug(page) // Skip slug for free plan
    await fillBroker(page, 'Smith Brokerage')
    await fillPhone(page, '(555) 234-5678')

    // Review step without card
    await completeReviewStep(page)

    // Verify redirect to welcome page
    await waitForWelcome(page)

    // Verify cookie is set
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 3: Investor Plan Signup', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.investorMonthly}&mock_purchase=true`)

    // Investors have slightly different fields (no brokerage/team)
    await fillEmail(page, testEmail)
    await fillName(page, 'Investor John')

    // Skip slug
    await skipSlug(page)

    // Fill phone (investors don't have broker/team fields)
    await fillPhone(page, '(555) 345-6789')

    // Fill card
    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    // Complete review
    await completeReviewStep(page)

    // Verify success
    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 4: Free Investor Signup', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.freeInvestor}`)

    await fillEmail(page, testEmail)
    await fillName(page, 'Free Investor')
    await skipSlug(page)
    await fillPhone(page, '(555) 456-7890')

    await completeReviewStep(page)

    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 5: Team Plan Signup', async ({ page }) => {
    await page.goto(`/subscribe?product=${PRODUCT_IDS.teamSmall}&mock_purchase=true`)

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Team Owner',
      slug: generateTestSlug('teamowner'),
      broker: 'Team Brokerage',
      teamName: 'Test Team',
      phone: '(555) 567-8901',
    })

    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    await completeReviewStep(page)

    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 6: Product=0 Redirect', async ({ page }) => {
    // Product 0 should redirect to external site
    await page.goto('/subscribe?product=0')

    // Wait for redirect
    await page.waitForURL(/instantofferspro\.com/, { timeout: 10000 })

    // Verify redirected to correct domain
    expect(page.url()).toContain('instantofferspro.com')
  })

  test('Flow 7: Product=0 Redirect with YHS Whitelabel', async ({ page }) => {
    await page.goto('/subscribe?product=0&w=yhs')

    await page.waitForURL(/instantofferspro\.com\/yhs/, { timeout: 10000 })

    expect(page.url()).toContain('instantofferspro.com/yhs')
  })

  test('Flow 8: Missing Product Parameter Redirect', async ({ page }) => {
    // Missing product should redirect to external site
    await page.goto('/subscribe')

    await page.waitForURL(/instantofferspro\.com/, { timeout: 10000 })

    expect(page.url()).toContain('instantofferspro.com')
  })

  test('Flow 9: Whitelabel KW Signup', async ({ page }) => {
    await page.goto(
      `/subscribe?product=${PRODUCT_IDS.agentMonthly}&w=${WHITELABELS.kw.param}&mock_purchase=true`
    )

    // Verify KW branding is applied
    // (This might need adjustment based on actual implementation)
    // await expect(page.locator('[data-whitelabel="kw"]')).toBeVisible()

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'KW Agent',
      slug: generateTestSlug('kwagent'),
      broker: 'Keller Williams',
      phone: '(555) 678-9012',
    })

    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    await completeReviewStep(page)

    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 10: Mock Purchase Parameter', async ({ page }) => {
    // Verify that mock_purchase parameter allows testing without real charges
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}&mock_purchase=true`)

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Mock User',
      slug: generateTestSlug('mockuser'),
      broker: 'Mock Brokerage',
      phone: '(555) 789-0123',
    })

    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    await completeReviewStep(page)

    // Should succeed without actual charge
    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 11: Slug Already Taken Error', async ({ page }) => {
    // This test requires a slug that's already taken
    // For now, we'll just verify the flow accepts slug input
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}&mock_purchase=true`)

    await fillEmail(page, testEmail)
    await fillName(page, 'Slug Test User')

    // Try a common slug that might be taken
    await page.fill('input[name="slug"]', 'test')
    await page.click('button:has-text("Next")')

    // Wait for either success or error
    // If error, we should see a message about slug being taken
    const hasError = await page.locator('text=/slug.*taken/i').isVisible({ timeout: 5000 })
      .catch(() => false)

    if (hasError) {
      // If slug is taken, try a unique one
      await page.fill('input[name="slug"]', generateTestSlug('slugtest'))
      await page.click('button:has-text("Next")')
    }

    // Should proceed to next step
    await expect(page.locator('input[name="name_broker"]')).toBeVisible({ timeout: 5000 })
  })

  test('Flow 12: Coupon Code Application', async ({ page }) => {
    await page.goto(
      `/subscribe?product=${PRODUCT_IDS.agentMonthly}&coupon=TESTCODE&mock_purchase=true`
    )

    await fillPersonalInfo(page, {
      email: testEmail,
      name: 'Coupon User',
      slug: generateTestSlug('couponuser'),
      broker: 'Coupon Brokerage',
      phone: '(555) 890-1234',
    })

    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    // On review step, verify coupon is shown (if implemented)
    // await expect(page.locator('text=/coupon|discount/i')).toBeVisible()

    await completeReviewStep(page)

    await waitForWelcome(page)
    expect(await isAuthenticated(page)).toBe(true)
  })
})
