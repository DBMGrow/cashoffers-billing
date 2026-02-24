# Manual Testing Checklist - Phase 5

This document provides a comprehensive manual testing checklist for verifying all 41 user flows across different whitelabels, product types, and user states.

## Overview

**Total Test Combinations**: 7 Whitelabels × 5 Product Types × 3 User States = 105 combinations

However, not all combinations are valid. Focus on the critical paths outlined below.

---

## Test Environment Setup

### Prerequisites
- [ ] Development server running (`npm run dev`)
- [ ] Database accessible and seeded with test products
- [ ] Square sandbox credentials configured
- [ ] SendGrid test email configured
- [ ] All migrations applied

### Test Accounts Needed
Create the following test users manually or via scripts:

1. **New User** - Does not exist in database
2. **Existing Free Agent** - Email exists, no subscription, role=AGENT
3. **Existing Premium Agent** - Email exists, active subscription, role=AGENT
4. **Existing Free Investor** - Email exists, no subscription, role=INVESTOR
5. **Existing Premium Investor** - Email exists, active subscription, role=INVESTOR
6. **Team Owner** - Email exists, role=TEAMOWNER, has team
7. **Inactive Premium** - Email exists, is_premium=1, active=0

---

## Critical Path Testing

### Path 1: Standard Agent Signup Flow

**Test Case**: Complete standard paid plan signup as a new agent user

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Navigate to `/subscribe?product=1&mock_purchase=true` | Subscribe page loads | ☐ |
| 2 | Enter new email and click Continue | Email accepted, proceed to name step | ☐ |
| 3 | Enter full name and click Continue | Name accepted, proceed to slug step | ☐ |
| 4 | Enter unique slug or skip | Slug accepted or skipped, proceed to broker | ☐ |
| 5 | Enter brokerage name and click Continue | Broker accepted, proceed to team (optional) | ☐ |
| 6 | Skip team name | Proceed to phone step | ☐ |
| 7 | Enter phone number and click Continue | Phone accepted, proceed to card step | ☐ |
| 8 | Enter valid card (4111111111111111) | Card accepted, proceed to review | ☐ |
| 9 | Review information, check consents | All info displayed correctly | ☐ |
| 10 | Click "Complete Sign Up" | Processing indicator shows | ☐ |
| 11 | Wait for completion | Redirect to welcome page | ☐ |
| 12 | Check browser cookies | `_api_token` cookie is set | ☐ |
| 13 | Navigate to /manage | Dashboard loads without requiring login | ☐ |

---

### Path 2: Free Plan Signup

**Test Case**: Free plan signup should not request card information

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Navigate to `/subscribe?product=free` | Subscribe page loads | ☐ |
| 2 | Enter new email | Email accepted | ☐ |
| 3 | Complete personal info steps | Name, slug, broker, phone steps complete | ☐ |
| 4 | Verify no card step | Card step is skipped entirely | ☐ |
| 5 | Review and submit | Complete signup without card | ☐ |
| 6 | Check welcome page | Welcome page displays | ☐ |
| 7 | Check cookie | Authentication cookie set | ☐ |

---

### Path 3: Investor Plan Signup

**Test Case**: Investor signup has different fields than agent signup

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Navigate to `/subscribe?product=11&mock_purchase=true` | Investor subscribe page loads | ☐ |
| 2 | Enter new email | Email accepted | ☐ |
| 3 | Enter name | Name accepted | ☐ |
| 4 | Skip slug | Slug step skipped | ☐ |
| 5 | Verify broker/team steps skipped | No broker or team name fields | ☐ |
| 6 | Enter phone | Phone accepted | ☐ |
| 7 | Enter card | Card accepted | ☐ |
| 8 | Complete review | Submit successful | ☐ |
| 9 | Check welcome | Welcome page displays | ☐ |

---

### Path 4: Token-Based Dashboard Access

**Test Case**: Users can access manage page via JWT token

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Generate JWT token for test user | Token generated | ☐ |
| 2 | Navigate to `/manage?t={token}` | Token verified automatically | ☐ |
| 3 | Check cookie | `_api_token` cookie set from token | ☐ |
| 4 | Verify dashboard loads | Dashboard options visible | ☐ |
| 5 | Navigate away and back | Cookie persists, no re-login needed | ☐ |

---

### Path 5: Plan Change with Role Restriction

**Test Case**: AGENT users cannot switch to INVESTOR plans

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Login as AGENT user | Dashboard loads | ☐ |
| 2 | Navigate to Manage Subscription | Subscription details display | ☐ |
| 3 | Click "Change Plan" | Available plans listed | ☐ |
| 4 | Verify INVESTOR plans hidden | Only AGENT/TEAMOWNER plans visible | ☐ |
| 5 | Attempt direct API call to change to INVESTOR plan | API returns ROLE_INCOMPATIBLE error | ☐ |

---

### Path 6: Product=0 Redirect

**Test Case**: Legacy product=0 URLs redirect to external site

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Navigate to `/subscribe?product=0` | Immediate redirect | ☐ |
| 2 | Verify redirect URL | Redirects to instantofferspro.com/agents | ☐ |
| 3 | Navigate to `/subscribe?product=0&w=yhs` | Redirect includes whitelabel | ☐ |
| 4 | Verify YHS redirect | Redirects to instantofferspro.com/yhs | ☐ |

---

### Path 7: Card Error Handling

**Test Case**: Declined cards show appropriate errors

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Start signup flow | Enter personal info | ☐ |
| 2 | Enter declined card (4000000000000002) | Card form accepts input | ☐ |
| 3 | Submit review | Processing starts | ☐ |
| 4 | Wait for error | Error message displays | ☐ |
| 5 | Verify error message | "Unable to process card" or similar | ☐ |
| 6 | Verify user not created | User not in database | ☐ |
| 7 | Verify stays on form | Can retry with different card | ☐ |

---

### Path 8: Downgrade Offer for Inactive Premium

**Test Case**: Inactive premium users offered reactivation

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Create inactive premium test user | User: is_premium=1, active=0 | ☐ |
| 2 | Start signup with same email | Email step completed | ☐ |
| 3 | Verify downgrade offer displayed | "Reactivate account" option shown | ☐ |
| 4 | Click "Reactivate" | Email sending initiated | ☐ |
| 5 | Verify confirmation message | "Check your email" message shown | ☐ |
| 6 | Check test email | Reactivation email received | ☐ |

---

## Whitelabel Testing Matrix

### Whitelabels to Test
1. **Default** (no `w` parameter)
2. **KW** (`w=kw`)
3. **YHS** (`w=yhs`)
4. **UCO** (`w=uco`)
5. **Platinum** (`w=platinum`)
6. **MOP** (`w=mop`)
7. **ECO** (`w=eco`)

### Whitelabel Verification Checklist

For each whitelabel, verify:

| Item | Default | KW | YHS | UCO | Platinum | MOP | ECO |
|------|---------|----|----|-----|----------|-----|-----|
| Logo displays correctly | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Primary color applied | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Secondary color applied | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Products filtered correctly | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Branding persists through flow | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Edge Cases and Error Testing

### Error Scenarios to Test

| Error Scenario | Test Steps | Expected Behavior | Status |
|----------------|-----------|-------------------|--------|
| **Missing email** | Submit without email | Validation error shown | ☐ |
| **Invalid email format** | Enter "test@invalid" | Email format error shown | ☐ |
| **Email already exists** | Use existing user email | Appropriate handling (offer login or error) | ☐ |
| **Slug already taken** | Use taken slug | "Slug taken" error, can retry | ☐ |
| **Invalid phone** | Enter "123" | Phone validation error | ☐ |
| **Expired card** | Use exp date in past | Expired card error | ☐ |
| **Insufficient funds card** | Use test card 4000000000009995 | Insufficient funds error | ☐ |
| **No consents checked** | Submit without checking boxes | Consent required error | ☐ |
| **Invalid JWT token** | Use malformed token in URL | Invalid token error | ☐ |
| **Expired JWT token** | Use expired token | Token expired error | ☐ |
| **Invalid product ID** | Navigate to product=99999 | Product not found error | ☐ |
| **Missing product parameter** | Navigate to /subscribe without product | Redirect to external site | ☐ |

---

## Browser Compatibility Testing

Test on multiple browsers to ensure compatibility:

### Desktop Browsers
- [ ] **Chrome** (latest) - All flows work
- [ ] **Firefox** (latest) - All flows work
- [ ] **Safari** (latest) - All flows work
- [ ] **Edge** (latest) - All flows work

### Mobile Browsers
- [ ] **Mobile Safari** (iOS) - Responsive layout, all flows work
- [ ] **Chrome Mobile** (Android) - Responsive layout, all flows work

### Specific Items to Verify
- [ ] Square payment iframe renders correctly on all browsers
- [ ] Form validation works consistently
- [ ] Cookie authentication works across browsers
- [ ] GSAP animations perform smoothly
- [ ] No console errors on any browser

---

## Performance Testing

### Load Time Benchmarks
- [ ] Subscribe page loads in < 2 seconds
- [ ] Manage page loads in < 2 seconds
- [ ] Product API responds in < 200ms
- [ ] Whitelabel API responds in < 200ms
- [ ] Token verification completes in < 500ms

### Network Conditions
Test under different network conditions:
- [ ] Fast 3G - All flows complete successfully
- [ ] Slow 3G - Loading indicators display appropriately
- [ ] Offline - Appropriate error messages shown

---

## Accessibility Testing

### WCAG Compliance Checks
- [ ] All form inputs have labels
- [ ] Error messages are announced to screen readers
- [ ] Keyboard navigation works throughout
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible
- [ ] ARIA labels present where needed

---

## Security Testing

### Security Verification
- [ ] XSS prevention - Script tags in inputs are escaped
- [ ] SQL injection prevention - Special characters handled safely
- [ ] CSRF protection - Tokens validated
- [ ] Cookie security - httpOnly and secure flags set correctly
- [ ] JWT expiration - Expired tokens rejected
- [ ] Role enforcement - Cannot bypass role restrictions via API

---

## Test Data Cleanup

After testing, ensure:
- [ ] All test users deleted from database
- [ ] Test subscriptions removed
- [ ] Test transactions cleaned up
- [ ] No test data left in production database

---

## Notes and Issues

### Issues Found
*Document any issues found during manual testing here*

1.
2.
3.

### Suggestions
*Document any improvement suggestions here*

1.
2.
3.

---

**Testing Completed By**: _______________
**Date**: _______________
**Environment**: _______________
**Overall Status**: ☐ Pass ☐ Fail ☐ Pass with issues
