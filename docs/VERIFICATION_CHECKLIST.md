# Verification Checklist - Phase 5

This document provides a comprehensive verification checklist to confirm that all 41 user flows are working correctly after implementation of phases 1-4.

---

## Quick Start

To run full verification:

```bash
# 1. Start the development server
npm run dev

# 2. Run E2E tests
npm run test:e2e

# 3. Review this checklist and verify each item manually
```

---

## Phase 1: Backend API Endpoints

### Signup Routes (api/routes/signup.ts)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/signup/purchasefree` | POST | ☐ | Creates free user account with cookie |
| `/api/signup/checkuserexists/:email` | GET | ☐ | Returns user status and offerDowngrade flag |
| `/api/signup/checkslugexists/:slug` | GET | ☐ | Validates slug availability |
| `/api/signup/sendreactivation` | POST | ☐ | Sends reactivation email |
| `/api/signup/products` | GET | ☐ | Returns products filtered by whitelabel |
| `/api/signup/whitelabels` | GET | ☐ | Returns all whitelabel branding data |

**Verification Steps:**
```bash
# Test products endpoint
curl "http://localhost:3000/api/signup/products?whitelabel=kw"

# Test whitelabels endpoint
curl "http://localhost:3000/api/signup/whitelabels"

# Test checkuserexists
curl "http://localhost:3000/api/signup/checkuserexists/test@example.com"
```

---

### Manage Routes (api/routes/manage.ts)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/manage/checkplan` | POST | ☐ | Validates plan change with role checking |
| `/api/manage/checktoken/:token` | GET | ☐ | Verifies JWT and sets cookie |
| `/api/manage/products` | GET | ☐ | Returns role-filtered products |
| `/api/manage/whitelabels` | GET | ☐ | Returns whitelabel branding (auth required) |
| `/api/manage/subscription/single` | GET | ☐ | Returns user's active subscription |
| `/api/manage/updatecard` | POST | ☐ | Updates user's card on file |
| `/api/manage/purchase` | POST | ☐ | Changes user's subscription plan |

**Verification Steps:**
```bash
# Test products endpoint (requires auth)
curl "http://localhost:3000/api/manage/products" \
  -H "Cookie: _api_token=YOUR_TOKEN"

# Test checkplan with role validation
curl -X POST "http://localhost:3000/api/manage/checkplan" \
  -H "Content-Type: application/json" \
  -H "x-api-token: YOUR_TOKEN" \
  -d '{"subscription": {"user_id": 1}, "productID": 11}'
```

---

### Auth Routes (api/routes/auth.ts)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/jwt/verify/:token` | GET/POST | ☐ | Verifies JWT token (checktoken) |
| `/api/auth/login` | POST | ☐ | Email/password authentication |
| `/api/auth/logout` | POST | ☐ | Clears authentication |

---

### Purchase Routes (api/routes/purchase.ts)

| Feature | Status | Notes |
|---------|--------|-------|
| Cookie setting after purchase | ☐ | `_api_token` cookie set on success |
| Mock purchase parameter support | ☐ | `?mock_purchase=true` uses sandbox |

---

## Phase 2: Frontend Dynamic System

### Context Providers

| Provider | Location | Status | Notes |
|----------|----------|--------|-------|
| ProductProvider | `providers/ProductProvider.tsx` | ☐ | Fetches products from API |
| WhitelabelProvider | `providers/WhitelabelProvider.tsx` | ☐ | Fetches whitelabels from API |

**Verification Steps:**
- [ ] ProductProvider loads products on mount
- [ ] ProductProvider filters by whitelabel in signup mode
- [ ] ProductProvider filters by role in manage mode
- [ ] WhitelabelProvider loads all whitelabels
- [ ] WhitelabelProvider sets initial whitelabel from URL param

---

### Page Components

| Page | File | Status | Providers | Product=0 Redirect |
|------|------|--------|-----------|-------------------|
| Subscribe | `app/(forms)/subscribe/page.tsx` | ☐ | ✓ ProductProvider<br>✓ WhitelabelProvider | ☐ |
| Manage | `app/(forms)/manage/page.tsx` | ☐ | ✓ ProductProvider<br>✓ WhitelabelProvider | N/A |

**Verification Steps:**
- [ ] Subscribe page redirects when `product=0`
- [ ] Subscribe page redirects to correct URL based on whitelabel
- [ ] Subscribe page loads ProductProvider with correct whitelabel
- [ ] Manage page loads ProductProvider in manage mode
- [ ] Both pages show loading states while fetching data

---

### Flow Components

| Component | File | Status | Uses Dynamic Products |
|-----------|------|--------|----------------------|
| SubscribeFlow | `components/forms/subscribe/SubscribeFlow.tsx` | ☐ | ☐ |
| ReviewStep | `components/forms/subscribe/steps/ReviewStep.tsx` | ☐ | ☐ |
| ManageFlow | `components/forms/manage/ManageFlow.tsx` | ☐ | ☐ |

**Verification Steps:**
- [ ] SubscribeFlow derives role from product data (not hardcoded isInvestor)
- [ ] ReviewStep displays product pricing from API data
- [ ] ManageFlow displays available plans from API
- [ ] No imports of `productsList.js` or `productsListInvestor.js`

---

### Hardcoded Files Deleted

| File | Status | Replacement |
|------|--------|-------------|
| `components/data/productsList.js` | ☐ Deleted | ProductProvider |
| `components/data/productsListInvestor.js` | ☐ Deleted | ProductProvider |

**Verification:**
```bash
# These should return "not found"
ls components/data/productsList.js
ls components/data/productsListInvestor.js
```

---

## Phase 3: Missing Flow Implementation

### Flow Implementation Status

| Flow # | Description | Status | File/Route |
|--------|-------------|--------|------------|
| 6 | Product=0 redirect | ☐ | `app/(forms)/subscribe/page.tsx` |
| 21 | Offer downgrade | ☐ | `/api/signup/sendreactivation` |
| 22-25 | Email-based login | ☐ | `/api/auth/login`, ManageFlow |
| 14 | Update billing card | ☐ | `/api/manage/updatecard` |
| 15 | Manage subscription view | ☐ | `/api/manage/subscription/single` |
| 16-18 | Change plan | ☐ | `/api/manage/purchase` |

**Verification Steps:**

#### Flow 6: Product=0 Redirect
```bash
# Visit these URLs and verify redirect
curl -I "http://localhost:3000/subscribe?product=0"
curl -I "http://localhost:3000/subscribe?product=0&w=yhs"
```
- [ ] Default redirects to instantofferspro.com/agents
- [ ] YHS redirects to instantofferspro.com/yhs

#### Flow 21: Downgrade Offer
- [ ] Create inactive premium user (is_premium=1, active=0)
- [ ] Start signup with same email
- [ ] Verify "offerDowngrade: true" returned from checkuserexists
- [ ] Verify downgrade offer step shows
- [ ] Click reactivate button
- [ ] Verify email sent
- [ ] Check email contains reactivation link

#### Flows 22-25: Email Login
- [ ] Navigate to /manage without token
- [ ] Enter existing user email
- [ ] Enter password
- [ ] Verify login successful
- [ ] Verify cookie set
- [ ] Try wrong password - verify error shown

#### Flow 14: Update Card
- [ ] Login to manage dashboard
- [ ] Click "Update Billing Info"
- [ ] Enter new card details
- [ ] Submit
- [ ] Verify success message
- [ ] Verify card updated in database

#### Flow 15: View Subscription
- [ ] Login as user with active subscription
- [ ] Navigate to "Manage Subscription"
- [ ] Verify subscription details displayed:
  - [ ] Product name
  - [ ] Monthly price
  - [ ] Renewal date
  - [ ] Status

#### Flows 16-18: Change Plan
- [ ] Login as AGENT user
- [ ] View available plans
- [ ] Verify only AGENT/TEAMOWNER plans shown
- [ ] Select new plan
- [ ] Verify prorated cost calculated
- [ ] Confirm change
- [ ] Verify subscription updated

---

## Phase 4: Database Enhancements

### Migration Status

| Migration | File | Status | Verification |
|-----------|------|--------|--------------|
| Add whitelabel branding | `005_add_whitelabel_branding.sql` | ☐ | Query Whitelabels table for `data` column |

**Verification Steps:**
```sql
-- Check if data column exists
DESCRIBE Whitelabels;

-- Verify branding data populated
SELECT whitelabel_id, code, data FROM Whitelabels;

-- Example expected result:
-- whitelabel_id: 2
-- code: kw
-- data: {"primary_color": "#D4002A", "secondary_color": "#000000", "logo_url": "/assets/logos/kw-logo.png"}
```

### Kysely Codegen

| Task | Status | Verification |
|------|--------|--------------|
| Run `npm run codegen` | ☐ | Check `api/lib/db.d.ts` updated |
| Whitelabels interface includes `data` | ☐ | Search for `data?: any` in db.d.ts |

**Verification:**
```bash
# Run codegen
npm run codegen

# Check if Whitelabels interface includes data field
grep -A 10 "interface Whitelabels" api/lib/db.d.ts
```

---

## Authentication & Authorization

### Cookie Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| Auth middleware checks cookie | ☐ | Checks both header and cookie |
| Cookie set after purchase | ☐ | POST /api/purchase |
| Cookie set after free signup | ☐ | POST /api/signup/purchasefree |
| Cookie set after token verify | ☐ | GET /api/manage/checktoken/:token |
| Cookie set after login | ☐ | POST /api/auth/login |
| Cookie persists across pages | ☐ | Navigation maintains auth |
| Cookie httpOnly flag | ☐ | Secure cookie settings |
| Cookie secure flag (prod) | ☐ | Only on production |

**Verification Steps:**
```bash
# Inspect cookies after signup
# Should see: _api_token with httpOnly=true

# Check auth middleware
grep "getCookie" api/lib/middleware/authMiddleware.ts
```

---

### Role Enforcement

| Validation | Location | Status | Notes |
|------------|----------|--------|-------|
| checkplan validates roles | `api/routes/manage.ts:84-97` | ☐ | AGENT ↔ INVESTOR blocked |
| manage/purchase validates roles | `api/routes/manage.ts:379-392` | ☐ | Backend enforcement |
| manage/products filters by role | `api/routes/manage.ts:207-209` | ☐ | Compatible roles only |

**Verification Steps:**
- [ ] AGENT user sees only AGENT/TEAMOWNER products in plan change
- [ ] INVESTOR user sees only INVESTOR products in plan change
- [ ] API rejects AGENT → INVESTOR plan change (ROLE_INCOMPATIBLE error)
- [ ] API rejects INVESTOR → AGENT plan change (ROLE_INCOMPATIBLE error)

**Test Script:**
```bash
# Create AGENT user and try to change to INVESTOR product
curl -X POST "http://localhost:3000/api/manage/purchase" \
  -H "Content-Type: application/json" \
  -H "Cookie: _api_token=AGENT_TOKEN" \
  -d '{"product_id": 11, "subscription_id": 1}'

# Expected response:
# {"success": "error", "error": "Cannot switch between AGENT and INVESTOR roles", "code": "ROLE_INCOMPATIBLE"}
```

---

## All 41 Flows Verification

### Signup Flows (1-12)

| # | Flow Description | E2E Test | Manual Test | Status |
|---|------------------|----------|-------------|--------|
| 1 | Standard paid plan signup | ☐ | ☐ | ☐ |
| 2 | Free plan signup | ☐ | ☐ | ☐ |
| 3 | Investor paid plan signup | ☐ | ☐ | ☐ |
| 4 | Free investor signup | ☐ | ☐ | ☐ |
| 5 | Team plan signup | ☐ | ☐ | ☐ |
| 6 | Product=0 redirect | ☐ | ☐ | ☐ |
| 7 | Product=0 with YHS redirect | ☐ | ☐ | ☐ |
| 8 | Missing product redirect | ☐ | ☐ | ☐ |
| 9 | Whitelabel KW signup | ☐ | ☐ | ☐ |
| 10 | Mock purchase parameter | ☐ | ☐ | ☐ |
| 11 | Slug already taken error | ☐ | ☐ | ☐ |
| 12 | Coupon code application | ☐ | ☐ | ☐ |

### Manage Flows (13-29)

| # | Flow Description | E2E Test | Manual Test | Status |
|---|------------------|----------|-------------|--------|
| 13 | Token-based dashboard access | ☐ | ☐ | ☐ |
| 14 | Update billing card | ☐ | ☐ | ☐ |
| 15 | View subscription details | ☐ | ☐ | ☐ |
| 16 | Change plan (no team to no team) | ☐ | ☐ | ☐ |
| 17 | Blocked AGENT→INVESTOR switch | ☐ | ☐ | ☐ |
| 18 | Team plan change | ☐ | ☐ | ☐ |
| 19 | Email-based login | ☐ | ☐ | ☐ |
| 20 | Invalid password error | ☐ | ☐ | ☐ |
| 21 | Offer downgrade to inactive | ☐ | ☐ | ☐ |
| 22 | View multiple subscriptions | ☐ | ☐ | ☐ |
| 23 | Cancel subscription | ☐ | ☐ | ☐ |
| 24 | Pause subscription | ☐ | ☐ | ☐ |
| 25 | Resume paused subscription | ☐ | ☐ | ☐ |
| 26 | Cookie persists across pages | ☐ | ☐ | ☐ |
| 27 | Manage without auth (redirect) | ☐ | ☐ | ☐ |
| 28 | Invalid token error | ☐ | ☐ | ☐ |
| 29 | Expired token error | ☐ | ☐ | ☐ |

### Error Flows (30-41)

| # | Flow Description | E2E Test | Manual Test | Status |
|---|------------------|----------|-------------|--------|
| 30 | Card declined error | ☐ | ☐ | ☐ |
| 31 | Insufficient funds error | ☐ | ☐ | ☐ |
| 32 | Expired card error | ☐ | ☐ | ☐ |
| 33 | Email already exists | ☐ | ☐ | ☐ |
| 34 | Invalid product ID | ☐ | ☐ | ☐ |
| 35 | Missing required fields | ☐ | ☐ | ☐ |
| 36 | Invalid email format | ☐ | ☐ | ☐ |
| 37 | Invalid phone format | ☐ | ☐ | ☐ |
| 38 | Network error handling | ☐ | ☐ | ☐ |
| 39 | Consents not checked | ☐ | ☐ | ☐ |
| 40 | Prorated calculation error | ☐ | ☐ | ☐ |
| 41 | Concurrent signup race | ☐ | ☐ | ☐ |

---

## Performance Benchmarks

### API Response Times

| Endpoint | Target | Actual | Status |
|----------|--------|--------|--------|
| GET /api/signup/products | < 200ms | ___ms | ☐ |
| GET /api/signup/whitelabels | < 200ms | ___ms | ☐ |
| GET /api/manage/products | < 200ms | ___ms | ☐ |
| POST /api/signup/checkuserexists | < 100ms | ___ms | ☐ |
| POST /api/manage/checktoken | < 500ms | ___ms | ☐ |

**Verification:**
```bash
# Test with curl and timing
time curl "http://localhost:3000/api/signup/products?whitelabel=kw"
```

### Page Load Times

| Page | Target | Actual | Status |
|------|--------|--------|--------|
| /subscribe | < 2s | ___s | ☐ |
| /manage | < 2s | ___s | ☐ |
| /welcome | < 1s | ___s | ☐ |

---

## Success Criteria Summary

✅ **Functional**: All 41 flows pass E2E tests

- [ ] All 12 signup flows working
- [ ] All 17 manage flows working
- [ ] All 12 error/edge case flows working

✅ **Security**: Role-based restrictions enforced

- [ ] AGENT ↔ INVESTOR switching blocked
- [ ] Backend validates all role changes
- [ ] Frontend filters products by role
- [ ] Auth middleware checks both header and cookie

✅ **Performance**: Product/whitelabel fetching < 200ms

- [ ] Products API responds quickly
- [ ] Whitelabels API responds quickly
- [ ] Caching implemented where appropriate

✅ **Maintainability**: No hardcoded products or whitelabels

- [ ] ProductProvider used throughout
- [ ] WhitelabelProvider used throughout
- [ ] No hardcoded product files remain
- [ ] Products managed via database only

✅ **Extensibility**: Adding new products/whitelabels requires only DB changes

- [ ] New product can be added via API/database
- [ ] New whitelabel can be added via migration
- [ ] No code changes needed for new products/whitelabels

---

## Running E2E Tests

### Execute Full Test Suite

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e signup-flows

# Run with UI for debugging
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test
npm run test:e2e -- --grep "Flow 1"
```

### View Test Results

```bash
# Open HTML report
npm run test:e2e:report
```

---

## Issue Tracking

### Critical Issues (Must Fix)

| Issue # | Description | Severity | Status | Assigned To |
|---------|-------------|----------|--------|-------------|
| | | | | |

### Minor Issues (Nice to Fix)

| Issue # | Description | Priority | Status | Assigned To |
|---------|-------------|----------|--------|-------------|
| | | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Developer** | __________ | ______ | __________ |
| **QA Lead** | __________ | ______ | __________ |
| **Product Owner** | __________ | ______ | __________ |

---

**Overall Status**: ☐ Ready for Production ☐ Needs Fixes ☐ Blocked

**Notes:**
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
