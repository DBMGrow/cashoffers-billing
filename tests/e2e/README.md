# E2E Testing Suite

This directory contains end-to-end tests for all 41 user flows in the CashOffers billing system.

## Overview

The E2E test suite uses Playwright to test complete user journeys through the signup, manage, and error handling flows. Tests are organized by flow category and include helpers for common operations.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug a specific test
npm run test:e2e:debug
```

## Test Structure

```
tests/e2e/
├── README.md                 # This file
├── signup-flows.test.ts      # Tests for flows 1-12 (signup)
├── manage-flows.test.ts      # Tests for flows 13-29 (manage)
├── error-flows.test.ts       # Tests for flows 30-41 (errors)
├── helpers/
│   ├── auth-helpers.ts       # Authentication utilities
│   ├── form-helpers.ts       # Form filling utilities
│   └── api-helpers.ts        # API interaction utilities
└── fixtures/
    └── test-data.ts          # Test data fixtures and constants
```

## Test Files

### `signup-flows.test.ts`
Tests all 12 signup flows including:
- Standard paid plan signup
- Free plan signup
- Investor plan signup
- Team plan signup
- Product=0 redirect
- Mock purchase testing
- Whitelabel variations
- Coupon code application
- Error handling for existing users

### `manage-flows.test.ts`
Tests all 17 manage flows including:
- Token-based dashboard access
- Email/password login
- View and manage subscriptions
- Plan changes with role restrictions
- Card updates
- Subscription pause/resume/cancel
- Cookie persistence
- Error handling for invalid/expired tokens

### `error-flows.test.ts`
Tests all error and edge case flows including:
- Card processing errors (declined, insufficient funds, expired)
- Email validation errors
- Missing required fields
- Network error handling
- Consent validation
- Concurrent signup race conditions

## Helper Functions

### Authentication Helpers (`helpers/auth-helpers.ts`)

```typescript
import { generateTestJWT, loginWithToken, setAuthCookie } from './helpers/auth-helpers'

// Generate JWT token for testing
const token = generateTestJWT({ id: 1, email: 'test@example.com' })

// Login with token and verify cookie set
await loginWithToken(page, token)

// Check if user is authenticated
const authed = await isAuthenticated(page)
```

### Form Helpers (`helpers/form-helpers.ts`)

```typescript
import { fillPersonalInfo, fillCard, completeReviewStep } from './helpers/form-helpers'

// Fill complete personal information
await fillPersonalInfo(page, {
  email: 'test@example.com',
  name: 'John Doe',
  slug: 'johndoe',
  broker: 'Test Brokerage',
  phone: '(555) 123-4567'
})

// Fill credit card
await fillCard(page, '4111111111111111', '12', '2025', '123')

// Complete review step
await completeReviewStep(page)
```

### API Helpers (`helpers/api-helpers.ts`)

```typescript
import { createTestUser, createTestSubscription, cleanupTestUser } from './helpers/api-helpers'

// Create test user
const user = await createTestUser({
  email: 'test@example.com',
  name: 'Test User',
  role: 'AGENT'
})

// Create test subscription
await createTestSubscription({
  user_id: user.user_id,
  product_id: 1,
  amount: 25000
})

// Cleanup after test
await cleanupTestUser('test@example.com')
```

## Test Data Fixtures

### Test Users
```typescript
import { TEST_USERS, generateTestEmail } from './fixtures/test-data'

// Pre-defined test user
const user = TEST_USERS.newUser

// Generate unique email for test
const email = generateTestEmail('prefix')
```

### Test Cards
```typescript
import { TEST_CARDS } from './fixtures/test-data'

// Valid test card (passes)
const validCard = TEST_CARDS.valid

// Declined test card (fails)
const declinedCard = TEST_CARDS.declined

// Insufficient funds test card
const insufficientCard = TEST_CARDS.insufficientFunds
```

### Whitelabels
```typescript
import { WHITELABELS } from './fixtures/test-data'

// Get whitelabel parameter
const kwParam = WHITELABELS.kw.param // 'kw'
```

## Running Specific Tests

### Run single test file
```bash
npm run test:e2e signup-flows
npm run test:e2e manage-flows
npm run test:e2e error-flows
```

### Run tests matching pattern
```bash
# Run all "Flow 1" tests
npm run test:e2e -- --grep "Flow 1"

# Run all signup tests
npm run test:e2e -- --grep "signup"

# Run all error tests
npm run test:e2e -- --grep "error"
```

### Run on specific browser
```bash
# Chrome only
npm run test:e2e -- --project=chromium

# Firefox only
npm run test:e2e -- --project=firefox

# Mobile Chrome
npm run test:e2e -- --project="Mobile Chrome"
```

## Debugging Tests

### Using Playwright UI Mode
```bash
npm run test:e2e:ui
```

This opens an interactive UI where you can:
- Step through tests
- See browser state at each step
- Time travel through test execution
- Inspect DOM and network requests

### Using Debug Mode
```bash
npm run test:e2e:debug
```

This runs tests with Playwright Inspector, allowing you to:
- Set breakpoints
- Step through test code
- Inspect page state
- Execute commands in console

### Using Headed Mode
```bash
npm run test:e2e:headed
```

This runs tests with the browser visible so you can see what's happening.

## Viewing Test Results

### HTML Report
After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

This opens a detailed report showing:
- Test results (pass/fail)
- Screenshots of failures
- Videos of test execution
- Trace files for debugging

### Console Output
Tests output results to console with:
- ✓ Passed tests (green)
- ✗ Failed tests (red)
- ○ Skipped tests (yellow)
- Duration and summary

## Test Configuration

Configuration is in `playwright.config.ts`:

```typescript
{
  testDir: './tests/e2e',
  baseURL: 'http://localhost:3000',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
}
```

### Environment Variables

- `TEST_BASE_URL` - Base URL for tests (default: http://localhost:3000)
- `JWT_SECRET` - Secret for generating test JWT tokens
- `API_KEY` - API key for test helpers

## Best Practices

### 1. Use Unique Test Data
Always generate unique emails and slugs to avoid conflicts:
```typescript
const testEmail = generateTestEmail()
const testSlug = generateTestSlug()
```

### 2. Clean Up After Tests
Use `afterEach` hooks to clean up test data:
```typescript
test.afterEach(async () => {
  await cleanupTestUser(testEmail)
})
```

### 3. Use Mock Purchase Parameter
Always use `mock_purchase=true` for paid plans to avoid real charges:
```typescript
await page.goto('/subscribe?product=1&mock_purchase=true')
```

### 4. Handle Async Operations
Wait for operations to complete:
```typescript
await page.waitForLoadState('networkidle')
await page.waitForURL(/\/welcome/)
```

### 5. Use Descriptive Test Names
Make test names clear and descriptive:
```typescript
test('Flow 1: Standard Paid Plan Signup', async ({ page }) => {
  // Test implementation
})
```

## Troubleshooting

### Tests Fail with "Network Error"
**Cause**: Development server not running
**Solution**: Start dev server with `npm run dev`

### Tests Fail with "Timeout"
**Cause**: Slow operations or animations
**Solution**: Increase timeout or use `test.slow()`:
```typescript
test('Slow test', async ({ page }) => {
  test.slow() // Triples timeout
  // Test implementation
})
```

### Tests Fail with "Element Not Found"
**Cause**: Selectors don't match actual DOM
**Solution**: Inspect page and update selectors:
```typescript
// Use Playwright Inspector
npm run test:e2e:debug

// Or check page content
await page.locator('body').innerHTML()
```

### Tests Fail on CI but Pass Locally
**Cause**: Different environments or timing issues
**Solution**: Use `test.retries` in config and check for race conditions

### Square Payment Form Not Working
**Cause**: Square iframe not loaded or selectors incorrect
**Solution**: Verify Square credentials and iframe selectors:
```typescript
await page.waitForSelector('#card-container', { timeout: 10000 })
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [USER_FLOWS.md](../../docs/USER_FLOWS.md) - Complete flow descriptions
- [VERIFICATION_CHECKLIST.md](../../docs/VERIFICATION_CHECKLIST.md) - Verification checklist
- [MANUAL_TESTING_CHECKLIST.md](../../docs/MANUAL_TESTING_CHECKLIST.md) - Manual testing guide

## Contributing

When adding new tests:
1. Follow existing test structure and naming
2. Use helpers for common operations
3. Add descriptive test names and comments
4. Clean up test data in `afterEach`
5. Use mock purchase for paid plans
6. Update this README if adding new helpers or patterns

## Support

For questions or issues:
- Check Playwright documentation
- Review existing tests for examples
- Check troubleshooting section above
- Review USER_FLOWS.md for flow details
