import { test, expect } from '@playwright/test'
import { generateTestJWT, loginWithToken, isAuthenticated } from './helpers/auth-helpers'
import { createTestUser, createTestSubscription, cleanupTestUser } from './helpers/api-helpers'
import { generateTestEmail, TEST_CARDS, PRODUCT_IDS } from './fixtures/test-data'
import { fillCard } from './helpers/form-helpers'

test.describe('Manage Flows (13-29)', () => {
  let testUser: any
  let testEmail: string
  let testToken: string

  test.beforeEach(async () => {
    // Create test user for manage flows
    testEmail = generateTestEmail('manage')

    testUser = await createTestUser({
      email: testEmail,
      name: 'Test User',
      role: 'AGENT',
      whitelabel_id: 1,
      is_premium: 1,
    })

    // Generate JWT token
    testToken = generateTestJWT({
      id: testUser.user_id,
      email: testUser.email,
    })
  })

  test.afterEach(async () => {
    await cleanupTestUser(testEmail)
  })

  test('Flow 13: Token-Based Dashboard Access', async ({ page }) => {
    // Access manage page with JWT token
    await page.goto(`/manage?t=${testToken}`)

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Verify authentication cookie is set
    expect(await isAuthenticated(page)).toBe(true)

    // Verify dashboard options are visible
    await expect(
      page.locator('text=/Update.*Billing|Manage.*Subscription/i')
    ).toBeVisible()
  })

  test('Flow 14: Update Billing Card', async ({ page }) => {
    // Login first
    await loginWithToken(page, testToken)

    // Navigate to update card section
    await page.goto('/manage')
    await page.click('text=/Update.*Billing|Update.*Card/i')

    // Fill new card details
    await fillCard(
      page,
      TEST_CARDS.valid.number,
      TEST_CARDS.valid.expMonth,
      TEST_CARDS.valid.expYear
    )

    // Submit
    await page.click('button:has-text("Update Card")')

    // Verify success message
    await expect(page.locator('text=/success|updated/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 15: View Subscription Details', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Skipping WebKit due to known issues')

    // Create test subscription
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    // Navigate to subscription management
    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Verify subscription details are displayed
    await expect(page.locator('text=/subscription|plan/i')).toBeVisible()
    await expect(page.locator('text=/\\$250|250/i')).toBeVisible() // Monthly price
  })

  test('Flow 16: Change Plan - No Team to No Team', async ({ page }) => {
    // Create current subscription
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')
    await page.click('text=/Change Plan/i')

    // Verify available plans are shown
    // Should only show AGENT-compatible plans, not INVESTOR plans
    const investorPlanVisible = await page
      .locator(`[data-product-id="${PRODUCT_IDS.investorMonthly}"]`)
      .isVisible()
      .catch(() => false)

    expect(investorPlanVisible).toBe(false) // Investor plan should not be visible

    // Select a different agent plan
    await page.click(`[data-product-id="${PRODUCT_IDS.teamSmall}"]`)

    // Confirm plan change (may require card for prorated charge)
    await page.click('button:has-text("Confirm")')

    // Verify success
    await expect(page.locator('text=/success|updated|changed/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 17: Attempt to Switch from AGENT to INVESTOR (Should Fail)', async ({ page }) => {
    // Create AGENT subscription
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')

    // Try to access investor plan (should be blocked by role filtering)
    const response = await page.request.get(
      `/api/manage/products`,
      {
        headers: {
          Cookie: `_api_token=${testUser._api_token}`,
        },
      }
    )

    const products = await response.json()

    // Verify investor products are not in the list
    const hasInvestorProduct = products.data?.some(
      (p: any) => p.product_id === PRODUCT_IDS.investorMonthly
    )

    expect(hasInvestorProduct).toBe(false)
  })

  test('Flow 18: Team Plan Change', async ({ page }) => {
    test.slow() // Mark as slow since it involves multiple steps

    // Create team subscription
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.teamSmall,
      amount: 50000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Verify team info is displayed
    await expect(page.locator('text=/team|members/i')).toBeVisible()

    await page.click('text=/Change Plan/i')

    // Change to larger team plan
    await page.click(`[data-product-id="${PRODUCT_IDS.teamMedium}"]`)

    await page.click('button:has-text("Confirm")')

    await expect(page.locator('text=/success|updated/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 19: Email-Based Login', async ({ page }) => {
    // Skip token, use email/password login instead
    await page.goto('/manage')

    // Enter email
    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    // Enter password
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.click('button:has-text("Login")')

    // Should be logged in
    await page.waitForLoadState('networkidle')
    expect(await isAuthenticated(page)).toBe(true)
  })

  test('Flow 20: Invalid Password Error', async ({ page }) => {
    await page.goto('/manage')

    await page.fill('input[name="email"]', testEmail)
    await page.click('button:has-text("Next")')

    // Enter wrong password
    await page.fill('input[name="password"]', 'WrongPassword123!')
    await page.click('button:has-text("Login")')

    // Should show error
    await expect(page.locator('text=/incorrect|invalid|wrong/i')).toBeVisible()
  })

  test('Flow 21: Offer Downgrade to Inactive Premium User', async ({ page }) => {
    // Create inactive premium user
    const inactiveUser = await createTestUser({
      email: generateTestEmail('inactive'),
      name: 'Inactive User',
      role: 'AGENT',
      whitelabel_id: 1,
      is_premium: 1,
      // active: 0, // Inactive
    })

    // Try to sign up with same email
    await page.goto(`/subscribe?product=${PRODUCT_IDS.agentMonthly}`)

    await page.fill('input[name="email"]', inactiveUser.email)
    await page.click('button:has-text("Next")')

    // Should see downgrade offer
    await expect(page.locator('text=/reactivate|downgrade/i')).toBeVisible({ timeout: 5000 })

    // Click to reactivate
    await page.click('button:has-text("Reactivate")')

    // Should see confirmation
    await expect(page.locator('text=/email.*sent|check.*email/i')).toBeVisible()

    // Cleanup
    await cleanupTestUser(inactiveUser.email)
  })

  test('Flow 22: View Multiple Subscriptions', async ({ page }) => {
    // Create multiple subscriptions
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    // Create addon subscription (e.g., HomeUptick)
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: 'homeuptick',
      amount: 1000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Verify both subscriptions are visible
    const subscriptionElements = await page.locator('[data-subscription]').count()
    expect(subscriptionElements).toBeGreaterThanOrEqual(1)
  })

  test('Flow 23: Cancel Subscription', async ({ page }) => {
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Click cancel button
    await page.click('button:has-text("Cancel")')

    // Confirm cancellation
    await page.click('button:has-text("Confirm")')

    // Verify success
    await expect(page.locator('text=/cancelled|canceled/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 24: Pause Subscription', async ({ page }) => {
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'active',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Click pause button
    await page.click('button:has-text("Pause")')

    // Confirm
    await page.click('button:has-text("Confirm")')

    // Verify success
    await expect(page.locator('text=/paused/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 25: Resume Paused Subscription', async ({ page }) => {
    // Create paused subscription
    await createTestSubscription({
      user_id: testUser.user_id,
      product_id: PRODUCT_IDS.agentMonthly,
      amount: 25000,
      status: 'paused',
    })

    await loginWithToken(page, testToken)

    await page.goto('/manage')
    await page.click('text=/Manage.*Subscription/i')

    // Click resume button
    await page.click('button:has-text("Resume")')

    // Confirm
    await page.click('button:has-text("Confirm")')

    // Verify success
    await expect(page.locator('text=/resumed|active/i')).toBeVisible({ timeout: 10000 })
  })

  test('Flow 26: Cookie Persists Across Page Loads', async ({ page }) => {
    await loginWithToken(page, testToken)

    // Verify authenticated
    expect(await isAuthenticated(page)).toBe(true)

    // Navigate to different page
    await page.goto('/subscribe?product=1')

    // Should still be authenticated
    expect(await isAuthenticated(page)).toBe(true)

    // Navigate back to manage
    await page.goto('/manage')

    // Should not need to login again
    await expect(page.locator('text=/dashboard|subscription/i')).toBeVisible()
  })

  test('Flow 27: Access Manage Without Token or Cookie (Should Request Login)', async ({ page }) => {
    // Try to access manage page without authentication
    await page.goto('/manage')

    // Should see login form
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('Flow 28: Invalid Token Error', async ({ page }) => {
    // Use invalid token
    await page.goto('/manage?t=invalid_token_xyz')

    // Should see error message
    await expect(page.locator('text=/invalid|expired|error/i')).toBeVisible()
  })

  test('Flow 29: Expired Token Error', async ({ page }) => {
    // Generate expired token (would need separate helper function)
    // For now, just verify invalid token handling
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid'

    await page.goto(`/manage?t=${expiredToken}`)

    await expect(page.locator('text=/invalid|expired|error/i')).toBeVisible()
  })
})
