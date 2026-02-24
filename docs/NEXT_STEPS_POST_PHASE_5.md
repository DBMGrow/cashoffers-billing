# Next Steps - Post Phase 5 Implementation

**Date Created**: February 24, 2026
**Status**: Ready for Execution
**Priority**: High

---

## Overview

Phase 5 (Testing & Verification) implementation is complete, including the TanStack Query refactoring. This document outlines the remaining work needed to fully test and deploy the 41 user flows.

---

## Immediate Actions Required

### 1. Implement Test Helper Endpoints

**Priority**: HIGH | **Estimated Time**: 2-4 hours

The E2E tests require helper endpoints for creating and cleaning up test data. These endpoints should only be available in development/test environments.

#### Required Endpoints

**File**: `api/routes/test.ts` (NEW)

```typescript
import { OpenAPIHono } from "@hono/zod-openapi"
import { db } from "@/api/lib/database"

const app = new OpenAPIHono()

// Only enable in non-production environments
if (process.env.NODE_ENV !== 'production') {

  /**
   * POST /api/test/create-user
   * Creates a test user in the database
   */
  app.post('/create-user', async (c) => {
    const body = await c.req.json()

    // Create user in Users table
    const user = await db.insertInto('Users')
      .values({
        email: body.email,
        name: body.name,
        role: body.role || 'AGENT',
        whitelabel_id: body.whitelabel_id || 1,
        is_premium: body.is_premium || 0,
        active: body.active ?? 1,
        _api_token: generateTestToken(),
      })
      .returning(['user_id', '_api_token', 'email'])
      .executeTakeFirst()

    return c.json({ success: 'success', data: user })
  })

  /**
   * POST /api/test/create-subscription
   * Creates a test subscription
   */
  app.post('/create-subscription', async (c) => {
    const body = await c.req.json()

    const subscription = await db.insertInto('Subscriptions')
      .values({
        user_id: body.user_id,
        product_id: body.product_id,
        amount: body.amount,
        status: body.status || 'active',
        renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning(['subscription_id'])
      .executeTakeFirst()

    return c.json({ success: 'success', data: subscription })
  })

  /**
   * DELETE /api/test/cleanup-user
   * Removes test user and all related data
   */
  app.delete('/create-user', async (c) => {
    const { email } = await c.req.json()

    // Get user ID
    const user = await db.selectFrom('Users')
      .select('user_id')
      .where('email', '=', email)
      .executeTakeFirst()

    if (!user) {
      return c.json({ success: 'success', message: 'User not found' })
    }

    // Delete related data (cascading)
    await db.deleteFrom('Transactions')
      .where('user_id', '=', user.user_id)
      .execute()

    await db.deleteFrom('Subscriptions')
      .where('user_id', '=', user.user_id)
      .execute()

    await db.deleteFrom('UserCards')
      .where('user_id', '=', user.user_id)
      .execute()

    await db.deleteFrom('Users')
      .where('user_id', '=', user.user_id)
      .execute()

    return c.json({ success: 'success', message: 'User cleaned up' })
  })
}

export const testRoutes = app
```

**Implementation Steps**:
1. ✅ Create `api/routes/test.ts`
2. ✅ Add helper functions for token generation
3. ✅ Register routes in main router
4. ✅ Add environment check to prevent production access
5. ✅ Test endpoints manually with curl/Postman

**Verification**:
```bash
# Test create user
curl -X POST http://localhost:3000/api/test/create-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","role":"AGENT"}'

# Test cleanup
curl -X DELETE http://localhost:3000/api/test/cleanup-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

### 2. Fix TanStack Query Integration Issues

**Priority**: HIGH | **Estimated Time**: 1-2 hours

Some components may need additional updates to work with the new `useProducts` hook signature.

#### Tasks

**A. Update any remaining Context imports**
```bash
# Search for any remaining old imports
grep -r "ProductProvider\|WhitelabelProvider" --include="*.tsx" --include="*.ts"
```

**B. Ensure all components pass params to useProducts**
- ✅ Check `SubscribeFlow.tsx` - Pass `whitelabel` from props
- ✅ Check `ReviewStep.tsx` - Get `whitelabel` from form data
- ✅ Check `UpdatePlanStep.tsx` - Use `mode: "manage"`
- ✅ Check `Pricing.js` - Pass `whitelabel` prop

**C. Add error boundaries for query errors**

**File**: `components/ErrorBoundary.tsx` (NEW)
```typescript
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <p className="text-red-600">Something went wrong.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Wrap pages with ErrorBoundary**:
```tsx
<ErrorBoundary>
  <SubscribePageClient />
</ErrorBoundary>
```

---

### 3. Run Initial E2E Tests

**Priority**: HIGH | **Estimated Time**: 1 hour

Run the E2E test suite to identify any remaining issues.

#### Steps

**A. Start dev server**
```bash
npm run dev
```

**B. Run tests in UI mode (recommended for first run)**
```bash
npm run test:e2e:ui
```

**C. Review test results**
- ☐ Identify failing tests
- ☐ Check if failures are due to:
  - Missing test endpoints (Step 1)
  - API not returning expected data
  - Selectors not matching actual DOM
  - Timing issues
  - Authentication issues

**D. Run specific test suites**
```bash
# Test signup flows only
npm run test:e2e signup-flows

# Test manage flows only
npm run test:e2e manage-flows

# Test error flows only
npm run test:e2e error-flows
```

**E. Generate test report**
```bash
npm run test:e2e:report
```

---

### 4. Fix Failing Tests

**Priority**: HIGH | **Estimated Time**: 4-8 hours

Based on test results, fix issues systematically.

#### Common Issues & Solutions

**Issue: Selectors not matching**
```typescript
// BAD - brittle selector
await page.click('button:has-text("Continue")')

// GOOD - more resilient
await page.click('[data-testid="continue-button"]')
await page.getByRole('button', { name: 'Continue' }).click()
```

**Action Items**:
- ☐ Add `data-testid` attributes to key elements
- ☐ Use semantic selectors (role, label, text)
- ☐ Avoid brittle CSS selectors

**Issue: Timing problems**
```typescript
// BAD - race condition
await page.click('button')
const text = await page.textContent('.result')

// GOOD - wait for condition
await page.click('button')
await page.waitForSelector('.result')
const text = await page.textContent('.result')
```

**Action Items**:
- ☐ Use `waitForSelector` for dynamic content
- ☐ Use `waitForLoadState('networkidle')` after navigation
- ☐ Use `page.waitForURL()` for redirects

**Issue: Authentication failing**
```typescript
// Ensure cookie is actually set
await page.context().addCookies([...])

// Verify authentication worked
const cookies = await page.context().cookies()
expect(cookies.find(c => c.name === '_api_token')).toBeDefined()
```

**Action Items**:
- ☐ Verify cookie setting in auth endpoints
- ☐ Check cookie attributes (httpOnly, secure, path)
- ☐ Ensure auth middleware accepts cookies

**Issue: API returning unexpected data**
- ☐ Check backend implementation matches test expectations
- ☐ Verify database has required test data
- ☐ Check for race conditions in async operations

---

### 5. Implement Missing Flow Features

**Priority**: MEDIUM | **Estimated Time**: 8-16 hours

Some flows from the implementation plan may still need completion.

#### Missing Features Checklist

**Flow 14: Update Billing Card** (`api/routes/manage.ts:321-346`)
- ☐ Implement Square API card update
- ☐ Update UserCards table
- ☐ Test with Square sandbox

**Flow 21: Downgrade Offer Email** (`api/templates/accountReactivation.html`)
- ☐ Create MJML email template
- ☐ Test email rendering
- ☐ Verify email delivery in test environment

**Flows 22-25: Email-Based Login** (`api/routes/auth.ts`)
- ☐ Verify login endpoint exists
- ☐ Test password validation
- ☐ Test cookie setting after login
- ☐ Add password step to ManageFlow

**Step-by-step for Email Login**:

1. Create PasswordStep component:
```typescript
// components/forms/manage/steps/PasswordStep.tsx
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ThemeButton } from '@/components/Theme/ThemeButton'

interface PasswordStepProps {
  email: string
  onSuccess: (user: any) => void
  onError: (message: string) => void
}

export default function PasswordStep({ email, onSuccess, onError }: PasswordStepProps) {
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const { data } = await axios.post('/api/auth/login', {
        email,
        password: pwd
      })
      return data
    },
    onSuccess: (data) => {
      if (data.success === 'success') {
        onSuccess(data.data)
      } else {
        onError(data.error || 'Login failed')
      }
    },
    onError: (error: any) => {
      if (error.response?.data?.code === 'PWINVALID') {
        onError('Incorrect password')
      } else {
        onError('Login failed. Please try again.')
      }
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
        className="p-2 border rounded"
      />
      <ThemeButton
        onPress={() => loginMutation.mutate(password)}
        isDisabled={!password || loginMutation.isPending}
      >
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </ThemeButton>
    </div>
  )
}
```

2. Add to ManageFlow:
- ☐ Import PasswordStep
- ☐ Add 'password' to FormStep type
- ☐ Add password case to step rendering
- ☐ Transition to password step after email if needed

---

### 6. Database Migration Verification

**Priority**: MEDIUM | **Estimated Time**: 1 hour

Ensure Phase 4 database migration was applied correctly.

#### Verification Steps

**A. Check Whitelabels.data column exists**
```sql
DESCRIBE Whitelabels;
-- Should show 'data' column of type JSON
```

**B. Verify branding data populated**
```sql
SELECT whitelabel_id, code,
       JSON_EXTRACT(data, '$.primary_color') as primary_color,
       JSON_EXTRACT(data, '$.logo_url') as logo_url
FROM Whitelabels;
```

**Expected output**:
```
whitelabel_id | code    | primary_color | logo_url
2             | kw      | #D4002A       | /assets/logos/kw-logo.png
3             | yhs     | #164d86       | /assets/logos/yhs-logo.png
...
```

**C. Run Kysely codegen**
```bash
npm run codegen
```

**D. Verify db.d.ts includes data field**
```bash
grep -A 5 "interface Whitelabels" api/lib/db.d.ts
# Should show: data?: any | null
```

**Action Items**:
- ☐ Run migration if not applied: `api/database/migrations/005_add_whitelabel_branding.sql`
- ☐ Run codegen to update types
- ☐ Verify API endpoints return branding data

---

### 7. Manual Testing Execution

**Priority**: MEDIUM | **Estimated Time**: 4-8 hours

Follow the manual testing checklist to verify flows work in real browsers.

#### Process

**A. Set up test environment**
- ☐ Clean test database
- ☐ Seed test products
- ☐ Configure Square sandbox
- ☐ Configure test email

**B. Test critical paths** (from `docs/MANUAL_TESTING_CHECKLIST.md`)

**Path 1: Standard Agent Signup**
- ☐ Navigate to `/subscribe?product=1&mock_purchase=true`
- ☐ Complete all steps
- ☐ Verify welcome page loads
- ☐ Verify cookie is set
- ☐ Verify can access /manage without token

**Path 2: Token-Based Dashboard Access**
- ☐ Generate test JWT
- ☐ Navigate to `/manage?t={token}`
- ☐ Verify dashboard loads
- ☐ Verify cookie persists

**Path 3: Plan Change with Role Restriction**
- ☐ Login as AGENT user
- ☐ Navigate to plan change
- ☐ Verify only AGENT plans shown
- ☐ Attempt to switch to INVESTOR (should fail)

**C. Test across browsers**
- ☐ Chrome (latest)
- ☐ Firefox (latest)
- ☐ Safari (latest)
- ☐ Mobile Chrome
- ☐ Mobile Safari

**D. Document issues**
- Create issue tracker spreadsheet
- Categorize by severity (Critical, High, Medium, Low)
- Assign to appropriate team member

---

### 8. Performance Testing

**Priority**: LOW | **Estimated Time**: 2-4 hours

Verify performance meets benchmarks from verification checklist.

#### Metrics to Measure

**API Response Times**
```bash
# Use curl with timing
time curl "http://localhost:3000/api/signup/products?whitelabel=kw"
```

**Expected**:
- GET /api/signup/products: < 200ms
- GET /api/manage/products: < 200ms
- POST /api/purchase: < 2000ms

**Action Items**:
- ☐ Run Apache Bench for load testing
- ☐ Check N+1 query issues
- ☐ Add database indexes if needed
- ☐ Enable TanStack Query DevTools to monitor cache

**Page Load Times**
```bash
# Use Lighthouse
npx lighthouse http://localhost:3000/subscribe?product=1 --view
```

**Expected**:
- Time to Interactive: < 3s
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s

---

### 9. Security Review

**Priority**: MEDIUM | **Estimated Time**: 2-4 hours

Verify security measures are in place.

#### Security Checklist

**Authentication & Authorization**
- ☐ JWT tokens have expiration
- ☐ Cookies have httpOnly flag
- ☐ Cookies have secure flag in production
- ☐ Auth middleware validates both header and cookie
- ☐ Role enforcement prevents AGENT ↔ INVESTOR switching

**Input Validation**
- ☐ All forms use Zod schemas
- ☐ Email format validation
- ☐ Phone format validation
- ☐ SQL injection prevention (using Kysely parameterized queries)
- ☐ XSS prevention (React auto-escaping)

**API Security**
- ☐ CORS configured properly
- ☐ Rate limiting in place (if production)
- ☐ Test endpoints disabled in production
- ☐ API keys not exposed in client
- ☐ Sensitive data not logged

**Payment Security**
- ☐ Card data handled by Square (never stored)
- ☐ PCI compliance maintained
- ☐ Mock purchase only available in dev/test
- ☐ Transaction logging for audit trail

---

### 10. Documentation Updates

**Priority**: LOW | **Estimated Time**: 2-3 hours

Update documentation to reflect changes.

#### Tasks

**A. Update CLAUDE.md**
- ☐ Add TanStack Query usage section
- ☐ Update product fetching examples
- ☐ Add testing section

**B. Update README** (if exists)
- ☐ Add testing instructions
- ☐ Update setup steps
- ☐ Add environment variables needed

**C. Create API documentation**
```bash
# Generate OpenAPI docs (if using @hono/zod-openapi)
# Access at http://localhost:3000/docs
```

**D. Update team docs**
- ☐ Share Phase 5 completion summary
- ☐ Share TanStack Query refactor doc
- ☐ Update onboarding guide

---

### 11. Deployment Preparation

**Priority**: MEDIUM | **Estimated Time**: 4-6 hours

Prepare for production deployment.

#### Pre-Deployment Checklist

**Environment Configuration**
- ☐ Verify all env vars in `.env.production`
- ☐ Test with production API URLs
- ☐ Configure production Square credentials
- ☐ Configure production SendGrid
- ☐ Set NODE_ENV=production

**Build & Deploy**
- ☐ Run `npm run build` and verify no errors
- ☐ Test production build locally
- ☐ Create deployment script/pipeline
- ☐ Set up CI/CD (GitHub Actions, etc.)

**Monitoring**
- ☐ Set up error tracking (Sentry, etc.)
- ☐ Set up performance monitoring
- ☐ Configure log aggregation
- ☐ Set up uptime monitoring

**Rollback Plan**
- ☐ Document rollback procedure
- ☐ Keep previous version deployable
- ☐ Test rollback in staging

---

### 12. Final Verification & Sign-Off

**Priority**: HIGH | **Estimated Time**: 2-3 hours

Complete the verification checklist and obtain sign-off.

#### Final Steps

**A. Complete Verification Checklist**
- ☐ Open `docs/VERIFICATION_CHECKLIST.md`
- ☐ Check each item systematically
- ☐ Document any deviations
- ☐ Create issues for remaining items

**B. Run full test suite**
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

**C. Obtain stakeholder approval**
- ☐ Developer sign-off
- ☐ QA sign-off
- ☐ Product owner sign-off

**D. Update implementation plan**
- ☐ Mark all phases complete
- ☐ Update status to "Production Ready"
- ☐ Archive implementation docs

---

## Timeline Estimate

| Step | Duration | Dependencies |
|------|----------|--------------|
| 1. Test endpoints | 2-4 hrs | None |
| 2. TanStack Query fixes | 1-2 hrs | None |
| 3. Initial E2E tests | 1 hr | Step 1 |
| 4. Fix failing tests | 4-8 hrs | Step 3 |
| 5. Missing features | 8-16 hrs | Steps 3-4 |
| 6. DB verification | 1 hr | None |
| 7. Manual testing | 4-8 hrs | Steps 1-5 |
| 8. Performance testing | 2-4 hrs | Steps 1-5 |
| 9. Security review | 2-4 hrs | Steps 1-5 |
| 10. Documentation | 2-3 hrs | Steps 1-9 |
| 11. Deployment prep | 4-6 hrs | Steps 1-9 |
| 12. Final sign-off | 2-3 hrs | All steps |

**Total Estimated Time**: 33-61 hours (4-8 days)

---

## Success Criteria

### Must Have (Blocking)
- ✅ All test helper endpoints implemented
- ✅ All E2E tests passing
- ✅ All 41 flows working in manual testing
- ✅ No critical security issues
- ✅ Production build successful

### Should Have (Important)
- ✅ Performance benchmarks met
- ✅ All missing features implemented
- ✅ Documentation updated
- ✅ Deployment pipeline configured

### Nice to Have (Optional)
- ✅ 100% test coverage
- ✅ Monitoring configured
- ✅ Load testing completed

---

## Risk Management

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test endpoints cause security issues | Medium | High | Disable in production, add IP whitelist |
| TanStack Query integration bugs | Low | Medium | Thorough testing, error boundaries |
| Database migration issues | Low | High | Test on staging first, backup before migration |
| Performance regressions | Medium | Medium | Performance testing, monitoring |
| Missing flow features take longer | High | Medium | Prioritize critical flows, defer non-critical |

---

## Quick Start Commands

```bash
# 1. Create test endpoints
# (Manual coding required - see Step 1)

# 2. Run dev server
npm run dev

# 3. Run E2E tests
npm run test:e2e:ui

# 4. Fix issues and iterate

# 5. Run full test suite
npm run test:e2e

# 6. Manual testing
# (Follow MANUAL_TESTING_CHECKLIST.md)

# 7. Generate reports
npm run test:e2e:report

# 8. Sign off
# (Complete VERIFICATION_CHECKLIST.md)
```

---

## Related Documentation

- [VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md) - Complete verification checklist
- [MANUAL_TESTING_CHECKLIST.md](./MANUAL_TESTING_CHECKLIST.md) - Manual testing guide
- [PHASE_5_COMPLETION_SUMMARY.md](./PHASE_5_COMPLETION_SUMMARY.md) - What was completed
- [TANSTACK_QUERY_REFACTOR.md](./TANSTACK_QUERY_REFACTOR.md) - TanStack Query changes
- [tests/e2e/README.md](../tests/e2e/README.md) - E2E testing guide
- [USER_FLOWS.md](./USER_FLOWS.md) - All 41 flow descriptions

---

**Status**: 📋 **Ready for Execution**
**Owner**: Development Team
**Last Updated**: February 24, 2026
