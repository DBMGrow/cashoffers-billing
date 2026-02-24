# Playwright Test Failures Analysis

## Test Results Summary

**Passing: 10 tests**
**Failing: 31 tests**
**Pass Rate: 24.4%**

---

## Critical Issues

### 1. **Timeout Issues (Most Common - 20+ tests)**

**Symptom**: Tests timeout after 30+ seconds waiting for elements that never appear.

**Affected Tests**:
- Flow 1: Standard Paid Plan Signup
- Flow 2: Free Plan Signup
- Flow 3: Investor Plan Signup
- Flow 4: Free Investor Signup
- Flow 5: Team Plan Signup
- Flow 9: Whitelabel KW Signup
- Flow 10: Mock Purchase Parameter
- Flow 12: Coupon Code Application
- Flow 13-29: All Manage Flows
- Flow 33: Email Already Exists Error
- Flow 39: Consent Checkboxes Not Checked
- Flow 41: Concurrent User Signup Race Condition

**Root Cause Analysis**:
1. Tests wait for `text=/Welcome to CashOffers\.PRO/i` which never appears
2. The welcome message text might be different in actual implementation
3. The application might be redirecting to a different URL than expected
4. The `mock_purchase=true` parameter might not be implemented or working

**What to Do**:
1. **Verify the welcome message text**: Check the actual text shown after successful signup
   - File to check: `app/(forms)/subscribe/SubscribePageClient.tsx`
   - Look for the welcome/success message component

2. **Check the mock_purchase implementation**:
   - File to check: `api/routes/purchase.ts`
   - Verify it accepts and handles `mock_purchase` query parameter
   - Ensure it skips actual Square API calls when enabled

3. **Verify redirect behavior**:
   - After successful signup, where does the app actually redirect?
   - Update `waitForWelcome()` helper to match actual behavior

4. **Add debug output to tests**:
   ```typescript
   // In form-helpers.ts:198
   export async function waitForWelcome(page: Page) {
     await page.waitForTimeout(2000)
     console.log('Current URL:', page.url())
     console.log('Page content:', await page.content())
     await page.waitForSelector('text=/Welcome to CashOffers\\.PRO/i', { timeout: 30000 })
   }
   ```

---

### 2. **API Test Endpoint Missing**

**Symptom**: Tests that call `/api/test/*` endpoints are failing.

**Affected Tests**:
- Flow 13-29: All Manage Flows (need `createTestUser`, `createTestSubscription`)
- Flow 21: Offer Downgrade to Inactive Premium User
- Flow 22: View Multiple Subscriptions

**Root Cause**: Test-only API endpoints don't exist in the codebase.

**What to Do**:
1. **Create test API routes** (`api/routes/test.ts`):
   ```typescript
   // POST /api/test/create-user
   // POST /api/test/create-subscription
   // DELETE /api/test/cleanup-user
   ```

2. **Add security**: Only enable these endpoints in test environment:
   ```typescript
   if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
     return res.status(404).json({ error: 'Not found' })
   }
   ```

3. **Alternative approach**: Use direct database access in tests instead of API endpoints
   - Tests already have access to DB via environment variables
   - Could import DB utils directly in test helpers

---

### 3. **Card Processing Tests (Flows 30-32)**

**Symptom**: Tests timeout trying to interact with Square payment iframes.

**Affected Tests**:
- Flow 30: Card Processing Error - Declined Card (18.8s timeout)
- Flow 31: Card Processing Error - Insufficient Funds (15.3s timeout)
- Flow 32: Expired Card Error (18.9s timeout)

**Root Cause**: Square payment forms use iframes that may not be loading or have different selectors.

**What to Do**:
1. **Verify Square iframe implementation**:
   - Check `components/forms/subscribe/steps/` for card component
   - Inspect actual iframe names and structure in browser

2. **Update `fillCard()` helper** (form-helpers.ts:113-136):
   ```typescript
   export async function fillCard(page: Page, ...) {
     // Wait for Square payment form container
     await page.waitForSelector('#card-container', { timeout: 10000 })

     // Add debug logging
     const iframes = await page.frames()
     console.log('Available iframes:', iframes.map(f => f.name()))

     // Find correct iframe selectors
     const cardFrame = page.frameLocator('iframe[name*="card"]')
     // ... rest of implementation
   }
   ```

3. **Consider using mock_purchase for these tests**:
   - These tests are checking error handling, not actual Square integration
   - Could mock the Square responses at API level instead

---

### 4. **Authentication & JWT Issues (Manage Flows)**

**Symptom**: Tests fail to authenticate with generated JWT tokens.

**Affected Tests**:
- Flow 13: Token-Based Dashboard Access (2.4s)
- Flow 14: Update Billing Card (31.2s)
- Flow 28: Invalid Token Error (5.9s)
- Flow 29: Expired Token Error (6.5s)

**Root Cause**:
1. JWT secret in tests might not match server secret
2. Token verification middleware might be checking additional fields
3. Cookie setting might not be working correctly

**What to Do**:
1. **Check JWT_SECRET environment variable**:
   ```bash
   # In .env.test or test setup
   JWT_SECRET=test-secret
   ```

2. **Verify token generation matches server expectations**:
   - File: `api/middleware/authMiddleware.js`
   - Check what fields are expected in JWT payload

3. **Debug cookie setting**:
   ```typescript
   export async function loginWithToken(page: Page, token: string) {
     await page.goto(`/manage?t=${token}`)
     await page.waitForLoadState('networkidle')

     // Debug
     const cookies = await page.context().cookies()
     console.log('Cookies after login:', cookies)

     const apiTokenCookie = cookies.find(c => c.name === '_api_token')
     return !!apiTokenCookie
   }
   ```

---

### 5. **Element Selector Issues**

**Symptom**: Tests can't find expected UI elements.

**Affected Tests**:
- Flow 14: Update Billing Card - can't find "Update Billing" button
- Flow 15-18: Subscription management - can't find "Manage Subscription" button
- Flow 19-20: Login flows - form structure might be different

**Root Cause**: UI text or structure differs from test expectations.

**What to Do**:
1. **Use more flexible selectors**:
   ```typescript
   // Instead of:
   await page.click('text=/Update.*Billing|Update.*Card/i')

   // Use data-testid attributes:
   await page.click('[data-testid="update-card-button"]')
   ```

2. **Add data-testid attributes to components**:
   ```tsx
   <button data-testid="update-card-button">Update Card</button>
   <button data-testid="manage-subscription-button">Manage Subscription</button>
   <button data-testid="next-button">Next</button>
   ```

3. **Take screenshots during test development**:
   ```typescript
   await page.screenshot({ path: 'debug-manage-page.png' })
   ```

---

### 6. **Consent Checkbox Test (Flow 39)**

**Symptom**: Test expects validation error when submitting without checking consent boxes, but times out instead.

**Root Cause**:
1. The button text is "Sign Up" not "Complete Sign Up"
2. The button might be disabled (correct) but test clicks it anyway
3. No visible error message appears

**What to Do**:
1. **Fix button text in test** (error-flows.test.ts:249):
   ```typescript
   // Should be:
   const submitButton = page.locator('button:has-text("Sign Up")')

   // Verify it's disabled
   await expect(submitButton).toBeDisabled()

   // Don't click it - just verify disabled state
   ```

2. **Update test to check disabled state instead of error message**:
   ```typescript
   test('Flow 39: Consent Checkboxes Not Checked', async ({ page }) => {
     // ... fill form steps ...

     // Verify submit button is disabled when no consents checked
     await expect(page.locator('button:has-text("Sign Up")')).toBeDisabled()

     // Check one consent
     const checkboxes = await page.locator('input[type="checkbox"][name="consent"]').all()
     await checkboxes[0].check()

     // Should still be disabled (need both)
     await expect(page.locator('button:has-text("Sign Up")')).toBeDisabled()

     // Check second consent
     await checkboxes[1].check()

     // Now should be enabled
     await expect(page.locator('button:has-text("Sign Up")')).toBeEnabled()
   })
   ```

---

## Tests That Are Passing ✓

1. **Flow 6**: Product=0 Redirect
2. **Flow 7**: Product=0 Redirect with YHS Whitelabel
3. **Flow 8**: Missing Product Parameter Redirect
4. **Flow 11**: Slug Already Taken Error
5. **Flow 34**: Invalid Product ID
6. **Flow 35**: Missing Required Fields
7. **Flow 36**: Invalid Email Format
8. **Flow 37**: Invalid Phone Format
9. **Flow 38**: Network Error Handling
10. **Flow 40**: Prorated Charge Calculation Error

**Why these pass**: They test basic validation, redirects, and error states without requiring full signup flow completion.

---

## Priority Action Plan

### Phase 1: Foundation (Critical - Do First)

1. **Identify actual welcome message/redirect**:
   - Run app manually with `npm run dev`
   - Complete a signup flow
   - Document exact URL and text that appears
   - Update `waitForWelcome()` helper

2. **Implement or verify mock_purchase parameter**:
   - Check if it exists in `api/routes/purchase.ts`
   - If not, add it:
     ```typescript
     if (req.query.mock_purchase === 'true') {
       // Skip Square API call
       // Return mock success response
     }
     ```

3. **Add test API endpoints** OR **use direct DB access**:
   - Decide on approach for test data setup
   - Implement chosen approach
   - Test with one manage flow

### Phase 2: Fix Test Helpers

4. **Add data-testid attributes to UI components**:
   - Subscribe flow: email, name, slug, broker, phone inputs
   - Subscribe flow: next buttons, submit button
   - Manage page: all action buttons
   - Review step: consent checkboxes

5. **Update form helpers to use data-testid**:
   - More reliable than text-based selectors
   - Won't break if button text changes

6. **Fix card processing helpers**:
   - Run app and inspect Square iframe structure
   - Update selectors to match actual implementation
   - Consider using mock_purchase for error tests

### Phase 3: Fix Individual Tests

7. **Fix Flow 39 (Consent Checkboxes)**:
   - Change to test disabled state instead of error message

8. **Fix JWT authentication tests**:
   - Ensure JWT_SECRET matches
   - Debug cookie setting
   - Verify middleware expectations

9. **Fix manage flow tests**:
   - Once test data setup works
   - Once data-testid attributes added
   - Update selectors as needed

### Phase 4: Edge Cases

10. **Flow 33 (Email Already Exists)**:
    - Verify actual behavior when email exists
    - Update test expectations

11. **Flow 41 (Race Condition)**:
    - May need actual backend race condition handling
    - Could be lower priority

---

## Environment Setup Checklist

Before running tests, ensure:

- [ ] `npm run dev` successfully starts the app
- [ ] Port 3000 is available
- [ ] Database is accessible and has test data
- [ ] Environment variables are set:
  - `TEST_BASE_URL=http://localhost:3000`
  - `API_KEY=<test-api-key>`
  - `JWT_SECRET=test-secret`
  - `ENABLE_TEST_ENDPOINTS=true`
- [ ] Main API is accessible at `API_URL` (or mocked)
- [ ] Square API credentials are set (or using sandbox)

---

## Debugging Tips

1. **Run single test with headed browser**:
   ```bash
   npx playwright test --headed --project=chromium signup-flows.test.ts:39
   ```

2. **Enable debug mode**:
   ```bash
   PWDEBUG=1 npx playwright test signup-flows.test.ts:39
   ```

3. **Check screenshots and videos**:
   - Located in `test-results/` folder
   - Generated on failure

4. **Add console.log in helpers**:
   ```typescript
   console.log('Current URL:', page.url())
   console.log('Page title:', await page.title())
   const content = await page.textContent('body')
   console.log('Page text:', content)
   ```

5. **Use page.pause() for inspection**:
   ```typescript
   await page.goto('/subscribe?product=1')
   await page.pause() // Opens inspector
   ```

---

## Next Steps

1. **Start with one passing flow** (Flow 6) - verify test infrastructure works
2. **Fix one simple signup flow** (Flow 2: Free Plan) - establish pattern
3. **Apply pattern to all signup flows**
4. **Fix manage flow infrastructure** (test endpoints)
5. **Fix remaining manage flows**
6. **Address edge cases and error flows**

The key is to work incrementally, fixing infrastructure issues first, then applying the solutions across all similar tests.
