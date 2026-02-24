# Complete User Flow Documentation - CashOffers.PRO Landing Pages

This document exhaustively lists every possible user flow through the subscribe, investor, and manage pages of the CashOffers.PRO landing application.

---

## Entry Points

### Landing Page Entry Points
1. **Main Landing Page** (`/` or `/index`) - Shows pricing and directs to subscribe page
2. **Investor Landing Page** (`/investor`) - Shows investor pricing and directs to investor subscribe
3. **Subscribe Page Direct** (`/subscribe`) - Entry point for signup flows
4. **Manage Page Direct** (`/manage`) - Entry point for account management

### URL Parameters
- `?product={productID}` - Pre-selects a product
- `?w={whitelabel}` - Sets whitelabel theme (yhs, kw, uco, platinum, mop, eco)
- `?t={token}` - JWT token for authenticated access (manage flow)
- `?coupon={couponCode}` - Applies coupon code (e.g., CPStart)
- `?add-card=true` - Forces add card flow for KW users (whitelabel_id 2)
- `?email={email}` - Pre-fills email
- `?mock_purchase=true` - Mocks card charge logic in backend (testing only)

---

## Architecture Overview

### API Route Structure
- **Signup Routes** (`/api/signup/**`): Used for new user registration flows
- **Manage Routes** (`/api/manage/**`): Used for existing user account management flows

### Product & Whitelabel Management
- **Products**: Fetched dynamically from database via API endpoints
  - Each product is associated with exactly one whitelabel
  - Products define user roles (AGENT, TEAMOWNER, INVESTOR) at the product level
  - Products are filtered by whitelabel and role when displayed to users
- **Whitelabels**: All branding (logos, colors, etc.) fetched from database
  - No hardcoded whitelabel components
  - Whitelabel associations determined by product selection

### Role-Based Restrictions
- **AGENT/TEAMOWNER** users:
  - Can only select products designated for AGENT/TEAMOWNER roles
  - Cannot switch to INVESTOR products
  - Cannot become INVESTORs through plan changes
- **INVESTOR** users:
  - Can only select products designated for INVESTOR role
  - Cannot switch to AGENT/TEAMOWNER products
  - Cannot become AGENTs/TEAMOWNERs through plan changes
- Role is determined by product selection, not a separate flag

### Authentication
- **Cookie-based authentication**: Established after successful signup/login
- **JWT tokens**: Used for initial access in manage flows, then converted to cookie session
- Authentication persists throughout user session

### Testing Features
- **?mock_purchase parameter**: When included in URL, mocks card charge logic in backend
  - Applies to all purchase and card update operations
  - Useful for testing flows without actual charges

---

## Subscribe Flows - New User Registration

### Flow 1: Standard Paid Plan Signup (Non-Platinum, Non-Investor)
**Entry**: `/subscribe?product={1,2,3,4,17}` or any standard product ID
**Whitelabel**: default, kw, yhs, uco, mop, eco

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
   - Auto-generated suggestion based on name
   - Can skip this step
   - If slug taken → Show "slug taken" error, return to slug step
   - If valid → Continue
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details (Square payment form)
9. **Review Step** - User reviews all information
   - Shows: Name, Email, Phone, Plan, Monthly charge, Signup fee (if applicable)
   - Requires: General consent checkbox, Communication consent checkbox
   - If card processing fails → Show "card error" step, return to card step
   - If API call fails → Show "error" step
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message, set password prompt
12. **Redirect to Dashboard** - User redirected to main dashboard with reset token

---

### Flow 2: Free Plan Signup (Product: "free")
**Entry**: `/subscribe?product=free`

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists and can downgrade → Flow branches to "Offer Downgrade" (Flow 21)
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Phone Step** - User enters phone number (NO slug step for free)
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Review Step** - User reviews information (NO card required)
   - Shows: Name, Email, Phone, Plan (Free)
   - Requires: General consent checkbox, Communication consent checkbox
8. **Sign Up** - API call to `/api/signup/purchasefree` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
9. **Welcome Step** - Success message
10. **Redirect to Dashboard** - User redirected with reset token

---

### Flow 3: Platinum Whitelabel Signup
**Entry**: `/subscribe?product={any}&w=platinum`
**Special**: No signup fee, starts directly at email (skips plan selection)

1. **Email Step** - User enters email (NO plan step)
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - No signup fee shown (coupon CPStart applied automatically)
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

### Flow 4: Investor Paid Plan Signup (Product: 11)
**Entry**: `/subscribe?product=11` or click from investor landing page
**Note**: User role (INVESTOR) is determined by the product itself, not a separate flag

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Phone Step** - User enters phone (NO slug step for investors)
5. **Card Step** - User enters credit card details
6. **Review Step** - Shows investor pricing ($99/mo)
   - Requires: General consent checkbox, Communication consent checkbox, Investor consent checkbox
7. **Sign Up** - API call to `/api/signup/purchase` (role assigned based on product)
   - Cookie-based authentication established upon successful signup
8. **Welcome Step** - Success message
9. **Redirect to Dashboard**

---

### Flow 5: Free Investor Signup (Product: "freeinvestor")
**Entry**: `/subscribe?product=freeinvestor`
**Note**: User role (INVESTOR) is determined by the product itself, not a separate flag

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Phone Step** - User enters phone (NO slug step)
5. **Review Step** - Shows free investor plan (NO card required)
   - Requires: General consent checkbox, Communication consent checkbox, Investor consent checkbox
6. **Sign Up** - API call to `/api/signup/purchasefree` (role assigned based on product)
   - Cookie-based authentication established upon successful signup
7. **Welcome Step** - Success message
8. **Redirect to Dashboard**

---

### Flow 6: Product=0 Entry (Plan Selection First) - **DEPRECATED**
**Entry**: `/subscribe?product=0`
**Status**: This flow is deprecated. Product selection is now handled externally.

**Previous behavior** (for reference):
1. **Plan Selection Step** - User selects a plan from grid
   - Available plans filtered by whitelabel
   - Shows pricing for each plan
   - User selects a plan
2. **Email Step** - User enters email
3. **Continue with standard flow** based on selected plan type (Flow 1, 2, 4, or 5)

**Current behavior**: Users should arrive with a specific product ID already set. If ?product=0 is encountered, redirect to external product selection.

---

### Flow 7: YHS Whitelabel Signup (with Signup Fee)
**Entry**: `/subscribe?product={13,14,15,16,18}&w=yhs`
**Special**: $250 signup fee applies
**Note**: Products fetched from API endpoint; each product associated with single whitelabel

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows $250 signup fee + monthly charge
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

### Flow 8: UCO Whitelabel Signup
**Entry**: `/subscribe?product={21,22,23,24,25}&w=uco`
**Special**: UCO-specific pricing and branding fetched from database
**Note**: Whitelabel branding (logos, colors, etc.) loaded from API, not hardcoded

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows UCO pricing
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

### Flow 9: MOP Whitelabel Signup
**Entry**: `/subscribe?product={26,27,28,29,30}&w=mop`
**Note**: Whitelabel branding (logos, colors, etc.) loaded from API, not hardcoded

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows MOP pricing
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

### Flow 10: ECO Whitelabel Signup
**Entry**: `/subscribe?product={33,34,35,36,37}&w=eco`
**Note**: Whitelabel branding (logos, colors, etc.) loaded from API, not hardcoded

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows ECO pricing
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

### Flow 11: KW HomeUptick Add-On (Product: 20)
**Entry**: `/subscribe?product=20&w=kw`
**Special**: $0 monthly charge, product associated with KW whitelabel only

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - Pre-filled with "Keller Williams"
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows $0/mo charge
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **"You're All Set HomeUptick" Step** - Special success message for HomeUptick
12. **End** (No dashboard redirect)

---

### Flow 12: Debug Product Signup (Product: 12)
**Entry**: `/subscribe?product=12`
**Special**: Hidden product for testing, $1.00 price, no signup fee

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}`
   - If user exists → Flow branches to "User Already Exists" (Flow 20)
   - If user doesn't exist → Continue
3. **Name Step** - User enters full name
4. **Slug Step** (SKIPPABLE) - User enters custom domain prefix
5. **Brokerage Name Step** - User enters brokerage name
6. **Team Name Step (OPTIONAL)** - User enters team name
7. **Phone Step** - User enters phone number
8. **Card Step** - User enters credit card details
9. **Review Step** - Shows $1.00 pricing, no signup fee
10. **Sign Up** - API call to `/api/signup/purchase` (includes ?mock_purchase param if set)
   - Cookie-based authentication established upon successful signup
11. **Welcome Step** - Success message
12. **Redirect to Dashboard**

---

## Manage Flows - Existing User Account Management

### Flow 13: Token-Based Dashboard Access (Premium User)
**Entry**: `/manage?t={valid_jwt_token}`
**Condition**: User is premium subscriber
**Note**: Cookie-based authentication used alongside token validation

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Token contains: email, name, phone, api_token, user_id, is_premium, has_subscription, role, whitelabel_id
   - Sets authentication cookie upon successful validation
3. **Dashboard Step** - User sees three options:
   - "Update Your Billing Info"
   - "Manage Your Subscription"
   - "Return to Dashboard"
4. User selects option:
   - **Option A**: Update Billing → Flow branches to "Update Card" (Flow 14)
   - **Option B**: Manage Subscription → Flow branches to "Manage Subscription" (Flow 15)
   - **Option C**: Return to Dashboard → Redirect to main dashboard

---

### Flow 14: Update Billing Card (From Dashboard)
**Entry**: From Dashboard (Flow 13), click "Update Your Billing Info"

1. **Update Card Step** - Shows card entry form
2. **User enters new card details** - Square payment form
3. **Submit** - API call to `/api/manage/updatecard` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication
   - If card processing fails → Show "card error" step
   - If success → Continue
4. **Card Updated Step** - Success message
5. **End** - User can start over or close

---

### Flow 15: Manage Subscription - View Current Plan
**Entry**: From Dashboard (Flow 13), click "Manage Your Subscription"

1. **Manage Subscription Step** - API call to `/api/manage/subscription/single`
   - Uses cookie-based authentication
2. **Display Current Subscription**:
   - Plan name
   - Team size (if applicable)
   - Monthly amount
   - Start date
   - Renewal date
   - Status
   - User's whitelabel association
3. User has two options:
   - **Back** → Return to Dashboard (Flow 13)
   - **Change Plan** → Flow branches to "Change Plan" (Flow 16)

---

### Flow 16: Change Plan - No Team, Simple Upgrade/Downgrade
**Entry**: From Manage Subscription (Flow 15), click "Change Plan"
**Condition**: User has no team
**Important**: Role-based restrictions apply

1. **Fetch Available Products** - API call to fetch products from database
   - Products filtered by user's whitelabel (only show products for user's whitelabel)
   - Products filtered by role compatibility:
     - AGENT/TEAMOWNER users: Cannot select INVESTOR products
     - INVESTOR users: Cannot select AGENT/TEAMOWNER products
   - Excludes current plan and free plan
2. **Update Plan Step** - Shows available filtered plans
   - User selects new plan from role-compatible, whitelabel-matched products
3. **Plan Check** - API call to `/api/manage/checkplan`
   - Uses cookie-based authentication
   - Sends: current subscription, selected product ID
   - Returns: change plan data, number of users, new product details
   - Validates role compatibility on backend
4. **Confirm Plan Changes Step** - Shows what will change:
   - Current plan → New plan
   - New monthly cost
   - Renewal date stays the same
   - Pro-rated charge for today (if applicable)
5. **Continue** - User clicks continue
6. **Review Change Plan Step** - Final review:
   - Name, Email, Phone
   - New plan name
   - Renewal date
   - Renewal cost
   - Cost today (prorated)
7. **Confirm Changes** - API call to `/api/manage/purchase` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication with existing api_token
   - If card processing fails → Show "card error" step
   - If role incompatibility detected → Show error
   - If success → Continue
8. **Plan Changed Step** - Success message
9. **End** - User can start over or close

---

### Flow 17: Change Plan - Has Team, Team Size Compatible
**Entry**: From Manage Subscription (Flow 15), click "Change Plan"
**Condition**: User has team, new plan allows current number of users
**Important**: Role-based restrictions apply

1. **Fetch Available Products** - API call to fetch products from database
   - Products filtered by user's whitelabel (only show products for user's whitelabel)
   - Products filtered by role compatibility:
     - AGENT/TEAMOWNER users: Cannot select INVESTOR products
     - INVESTOR users: Cannot select AGENT/TEAMOWNER products
2. **Update Plan Step** - Shows available filtered plans
   - User selects new plan from role-compatible, whitelabel-matched products
3. **Plan Check** - API call to `/api/manage/checkplan`
   - Uses cookie-based authentication
   - Checks if team size is compatible
   - Current active users ≤ new plan's max users → Compatible
   - Validates role compatibility on backend
4. **Confirm Plan Changes Step** - Shows changes:
   - Current plan → New plan
   - Team size change message (if increasing or decreasing max)
   - Pro-rated charge for today (if increasing team size)
   - "Changes will take effect immediately"
5. **Continue** - User clicks continue
6. **Review Change Plan Step** - Final review with prorated cost
7. **Confirm Changes** - API call to `/api/manage/purchase` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication
8. **Plan Changed Step** - Success message
9. **End**

---

### Flow 18: Change Plan - Has Team, Too Many Active Users
**Entry**: From Manage Subscription (Flow 15), click "Change Plan"
**Condition**: User has team, new plan doesn't allow current number of users
**Important**: Role-based restrictions apply

1. **Fetch Available Products** - API call to fetch products from database
   - Products filtered by user's whitelabel (only show products for user's whitelabel)
   - Products filtered by role compatibility:
     - AGENT/TEAMOWNER users: Cannot select INVESTOR products
     - INVESTOR users: Cannot select AGENT/TEAMOWNER products
2. **Update Plan Step** - Shows available filtered plans
   - User selects new plan with smaller team size
3. **Plan Check** - API call to `/api/manage/checkplan`
   - Uses cookie-based authentication
   - Detects: Current active users > new plan's max users
4. **Reduce Max Users Step** - Error message:
   - "You have more active users than the plan you selected allows"
   - Must deactivate users in main dashboard before changing plan
5. **User must go to main dashboard** - No way to proceed
6. **End** - User must handle in main application

---

### Flow 19: Token-Based Access - Non-Premium User, No Subscription
**Entry**: `/manage?t={valid_jwt_token}`
**Condition**: User is not premium, no subscription

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Determines user is not premium
   - Sets authentication cookie
3. **Fetch Available Products** - API call to fetch products from database
   - Products filtered by user's whitelabel
   - Products filtered by user's role
4. **Update Plan Step** - Shows available filtered plans for user to select
5. **User selects plan**
6. **Generate unique slug** - Auto-generated from name
7. **Slug Step** (SKIPPABLE) - User can customize or skip
8. Continue with standard signup flow depending on plan selected
   - Uses `/api/manage/purchase` endpoint
   - Cookie-based authentication throughout

---

### Flow 20: User Email Already Exists (Subscribe Mode)
**Entry**: During email step in any subscribe flow
**Condition**: Email exists in system

1. **Email Step** - User enters email that already exists
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}` returns userExists: true
3. **User Exists Step** - Error message:
   - "This Email is already in use"
   - "Please try a different email"
4. **User can**:
   - Click "Start Over" to return to beginning
   - Enter different email

---

### Flow 21: Offer Downgrade to Free (Subscribe Mode)
**Entry**: During email step when user enters email for free plan
**Condition**: User exists, requesting free plan, and can downgrade (offerDowngrade: true)

1. **Email Step** - User enters email (free plan selected)
2. **Check Email Exists** - API call to `/api/signup/checkuserexists/{email}` returns userExists: true, offerDowngrade: true
3. **Offer Downgrade Step** - Message:
   - "Reactivate Account"
   - "Do you want to reactivate your account as a freemium user?"
4. **User confirms** - API call to `/api/signup/sendreactivation` sends reactivation email
5. **Offer Downgrade Confirm Step** - "Email Sent. Please check your email for an invitation to reactivate your account."
6. **End**

---

### Flow 22: Email-Based Login (Manage Mode - No Token)
**Entry**: `/manage` without token parameter, user enters email
**Condition**: User exists in system

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/manage/checkuserexists/{email}`
   - Returns: userExists: true, hasCard: true
3. **Login Step** - User enters password
   - API call to `/api/manage/login`
   - If wrong password → "Incorrect Password" step, return to login
   - If correct → API validates and returns user data
   - Sets authentication cookie
4. **Dashboard Step** - Flow continues to (Flow 13)

---

### Flow 23: Email-Based Login - User Needs Card Setup
**Entry**: `/manage` without token, user enters email
**Condition**: User exists but doesn't have card, can set up card

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/manage/checkuserexists/{email}` returns:
   - userExists: true
   - hasCard: false
   - canSetUpCard: true
   - plan: {productID}
   - whitelabel_id: {id}
   - role: {role}
3. **Login Step** - User enters password
   - API call to `/api/manage/login`
   - Sets authentication cookie
4. **Fetch Available Products** - API call to fetch products from database
   - Filtered by user's whitelabel and role
5. **Update Plan Step** - User sees available filtered plans (setup card mode)
6. **User selects plan** → Continue with plan change flow using `/api/manage/purchase`
7. **Review Step**
8. **Setup Card Complete Step** - Success message
9. **End**

---

### Flow 24: Email-Based Login - User Cannot Setup Card
**Entry**: `/manage` without token, user enters email
**Condition**: User exists, no card, cannot set up card

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/manage/checkuserexists/{email}` returns:
   - userExists: true
   - hasCard: false
   - canSetUpCard: false
3. **No Billing Step** - Error message:
   - "This account is not authorized to manage billing"
   - "Please try a different email, or contact support"
4. **End** - User cannot proceed

---

### Flow 25: Email Doesn't Exist (Manage Mode)
**Entry**: `/manage` without token, user enters non-existent email
**Condition**: Email not found in system

1. **Email Step** - User enters email
2. **Check Email Exists** - API call to `/api/manage/checkuserexists/{email}` returns userExists: false
3. **User Does Not Exist Step** - Error message:
   - "There's no account linked to this email"
   - "Please try a different email"
4. **User can**:
   - Click "Start Over" to try again
   - Enter different email

---

### Flow 26: Token-Based Access - Investor (No Subscription)
**Entry**: `/manage?t={valid_jwt_token}`
**Condition**: role = "INVESTOR", has_subscription = false
**Note**: Product ID for investor plan determined by product's role assignment

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Detects INVESTOR role with no subscription
   - Sets authentication cookie
3. **Fetch Investor Products** - API call to fetch products for INVESTOR role and user's whitelabel
4. **New Billing Step** - "Hey {name}, Let's get your billing set up"
5. **Card Step** - User enters card details (investor product preselected)
6. **Review Step** - Shows investor plan pricing
7. **Sign Up** - API call to `/api/manage/purchase` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication
8. **Setup Card Complete Step** - Success message
9. **End**

---

### Flow 27: Token-Based Access - Invited Investor
**Entry**: `/manage?t={valid_jwt_token}`
**Condition**: role = "INVITEDINVESTOR", has_subscription = false
**Note**: Product ID for investor plan determined by product's role assignment

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Detects INVITEDINVESTOR role
   - Sets authentication cookie
3. **Fetch Investor Products** - API call to fetch products for INVESTOR role and user's whitelabel
4. **Card Step** - Goes directly to card entry (investor product preselected)
5. **Review Step** - Shows investor plan pricing
6. **Sign Up** - API call to `/api/manage/purchase` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication
7. **Setup Card Complete Step** - Success message
8. **End**

---

### Flow 28: Token-Based KW User Add Card
**Entry**: `/manage?t={valid_jwt_token}&add-card=true`
**Condition**: User has whitelabel_id = 2 (Keller Williams)
**Note**: Product 20 (HomeUptick) is KW-specific and fetched from API

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Detects add-card=true and whitelabel_id = 2
   - Sets authentication cookie
3. **Fetch KW Products** - API call to fetch products for whitelabel_id 2
4. **New Card KW Step** - "Hey {name}, Let's add a card to your account"
5. **Card Step** - User enters card details (product 20 preselected)
6. **Review Step** - Shows HomeUptick add-on ($0/mo)
7. **Sign Up** - API call to `/api/manage/purchase` (includes ?mock_purchase param if set)
   - Uses cookie-based authentication
8. **You're All Set HomeUptick Step** - Success message
9. **End**

---

### Flow 29: Token-Based Login Then Setup Card (Non-KW)
**Entry**: `/manage?t={valid_jwt_token}&add-card=true`
**Condition**: User needs to set up card but not KW whitelabel

1. **Check Token Step** - Validates JWT token
2. **Token Validation** - API call to `/api/manage/auth/jwt/verify/{token}`
   - Sets authentication cookie
3. **Login Step** - User enters password (if required)
4. **Fetch Available Products** - API call to fetch products filtered by user's whitelabel and role
5. **Update Plan Step** - User selects plan from filtered options
6. **Slug Step** (if needed)
7. Continue with plan change/setup flow using `/api/manage/purchase`
8. **Setup Card Complete Step**
9. **End**

---

## Error and Edge Case Flows

### Flow 30: Card Processing Error (Any Signup/Update)
**Trigger**: Card payment fails during purchase

1. **Any flow reaches card submission**
2. **API returns error code PUR08**
3. **Card Error Step** - "We were unable to process your Card. Please ensure your card information is correct."
4. **Returns to Card Step** - User can re-enter card information
5. **Retry** - User submits again
6. Continue with original flow

---

### Flow 31: Slug Already Taken
**Trigger**: User enters slug that's already in use

1. **Slug Step** - User enters custom slug
2. **Check Slug** - API call to `/api/signup/checkslugexists/{slug}` (or `/api/manage/checkslugexists/{slug}` in manage mode)
3. **API returns slugExists: true**
4. **Slug Taken Step** - "This Domain Prefix is already in use. Please try a different one."
5. **Back to Slug** - Returns to slug entry
6. **User enters new slug** - Try again
7. Continue with flow

---

### Flow 32: General API Error
**Trigger**: Any API call fails unexpectedly

1. **Any step with API call**
2. **API returns error (not specific error handled above)**
3. **Error Step** - "Something went wrong. Please try again later."
4. **End** - User can click "Start Over"

---

### Flow 33: Wrong Password (Manage Mode)
**Trigger**: User enters incorrect password during login

1. **Login Step** - User enters password
2. **API call to `/api/manage/login` returns error: "PWINVALID"**
3. **Wrong Password Step** - "Incorrect Password. Please try again."
4. **Back to Login** - Returns to password entry
5. User can:
   - Re-enter password
   - Click "Reset Password" link (redirects to forgot password page)

---

### Flow 34: Token Validation Fails (Manage Mode)
**Trigger**: Invalid or expired JWT token

1. **Check Token Step** - Attempts to validate token
2. **API call to `/api/manage/auth/jwt/verify/{token}` returns error or invalid token**
3. **Email Step** - Redirected to email entry
4. Continue with email-based login flow

---

### Flow 35: No Product Parameter (Subscribe Mode)
**Entry**: `/subscribe` without product parameter

1. **Check for product in URL**
2. **No product found**
3. **Check whitelabel** - If w=yhs:
   - Redirect to `https://www.instantofferspro.com/yhs`
4. **Otherwise**:
   - Redirect to `https://www.instantofferspro.com/agents`
5. **End** - User leaves landing page

---

### Flow 36: Landing Page to Subscribe - Standard Product
**Entry**: User clicks "Sign Up" on landing page pricing card

1. **Landing Page** - User views pricing
2. **Click "Sign Up" button** on product card
3. **Redirect** - `/subscribe?product={productID}&w={whitelabel}`
4. **Continue** - Enters subscribe flow for that product

---

### Flow 37: Landing Page to Subscribe - Investor Product
**Entry**: User clicks "Sign Up" on investor landing page

1. **Investor Landing Page** - User views investor pricing
2. **Click "Sign Up" button** on investor product card
3. **Redirect** - `/subscribe?product=11` or `/subscribe?product=freeinvestor`
4. **Continue** - Enters investor subscribe flow

---

## Whitelabel-Specific Flows

### Flow 38: YHS Whitelabel - No Product Redirect
**Entry**: `/subscribe?w=yhs` without product

1. **Check for product parameter**
2. **No product found**
3. **Check whitelabel = "yhs"**
4. **Redirect** - `https://www.instantofferspro.com/yhs`
5. **End**

---

### Flow 39: Default Whitelabel - No Product Redirect
**Entry**: `/subscribe` without product, no whitelabel or default whitelabel

1. **Check for product parameter**
2. **No product found**
3. **Redirect** - `https://www.instantofferspro.com/agents`
4. **End**

---

## Start Over Functionality

### Flow 40: User Clicks "Start Over" (Any Flow)
**Trigger**: User clicks "Start Over" button (available after initial steps)

1. **Any step** (after start step)
2. **User clicks "Start Over"**
3. **Reset all form data**:
   - Email cleared
   - Name cleared
   - Phone cleared
   - Password cleared
   - Card cleared
   - Slug cleared
4. **Return to start step** - Depends on initial entry:
   - Subscribe mode: Return to email or plan
   - Manage mode: Return to checkToken or email
5. **Continue** - User starts flow again

---

## Hidden Product Flows (Admin/Testing)

### Flow 41: Hidden Large Team Products (5-9)
**Entry**: `/subscribe?product={5,6,7,8,9}`
**Condition**: Products hidden from normal UI but accessible via direct URL

1. **Standard subscribe flow** applies
2. **Product shows in plan selection** if directly accessed
3. **Pricing varies** (see productsList):
   - Product 5: $2,000/mo for 20 users
   - Product 6: $1,750/mo for 50 users
   - Product 7: $1,500/mo for 75 users
   - Product 8: $250/mo for 100 users
   - Product 9: $15,000/mo for 200 users
4. **Continue** with standard paid signup flow

---

## Summary Statistics

### Total Unique User Flows
- **Subscribe Flows (New Users)**: 12 primary flows (Flow 1-12)
- **Manage Flows (Existing Users)**: 17 primary flows (Flow 13-29)
- **Error/Edge Cases**: 11 flows (Flow 30-40)
- **Hidden/Special**: 1 flow (Flow 41)

### Total Flow Count: **41 distinct flows**

---

## Flow Decision Points

### Email Check Decision Points
1. User exists vs doesn't exist
2. User exists and can downgrade (free plan)
3. User has card vs no card
4. User can setup card vs cannot

### Token Validation Decision Points
1. Token valid vs invalid
2. User is premium vs not premium
3. User has subscription vs no subscription
4. User role: standard vs INVESTOR vs INVITEDINVESTOR
5. Whitelabel ID (special handling for KW = 2)
6. Add-card parameter present

### Plan Change Decision Points
1. User has team vs no team
2. New plan team size compatible vs incompatible
3. Current users <= new max users vs current users > new max users
4. Upgrading team size (prorated charge) vs downgrading (no immediate charge)
5. User's whitelabel matches product's whitelabel
6. User's role matches product's role requirements (AGENT/TEAMOWNER ↔ INVESTOR blocked)
7. Products fetched from API and filtered by whitelabel and role

### Product Type Decision Points
1. Free plan vs paid plan
2. Investor plan vs standard plan (role-based)
3. Whitelabel-specific product (single whitelabel per product)
4. HomeUptick add-on (Product 20)
5. Hidden products vs visible products
6. Product fetched from API (not hardcoded)
7. Role compatibility (AGENT/TEAMOWNER vs INVESTOR)

### Slug Flow Decision Points
1. Free plan (skip slug) vs paid plan (show slug)
2. Investor (skip slug) vs standard (show slug)
3. Slug valid vs taken vs skipped

### Card Requirement Decision Points
1. Free plan (no card) vs paid plan (card required)
2. New signup vs card update
3. Card processing success vs failure

---

## Testing Checklist

To test all flows, you must test each combination of:

### Entry Points (4)
- [ ] Landing page → Subscribe
- [ ] Investor page → Subscribe
- [ ] Direct subscribe URL
- [ ] Direct manage URL

### Whitelabels (7)
- [ ] Default
- [ ] YHS
- [ ] KW
- [ ] UCO
- [ ] Platinum
- [ ] MOP
- [ ] ECO

### Product Types (7 categories)
- [ ] Free (product="free")
- [ ] Standard paid (products 1,2,3,4,17)
- [ ] Free investor (product="freeinvestor")
- [ ] Paid investor (product=11)
- [ ] YHS products (13,14,15,16,18) - single whitelabel association
- [ ] UCO products (21,22,23,24,25) - single whitelabel association
- [ ] MOP products (26,27,28,29,30) - single whitelabel association
- [ ] ECO products (33,34,35,36,37) - single whitelabel association
- [ ] HomeUptick add-on (product=20)
- [ ] Debug product (product=12)
- [ ] Hidden large team products (5-9)
- [ ] Products fetched from API endpoint
- [ ] Role-based product filtering (AGENT/TEAMOWNER vs INVESTOR)

### User States (Subscribe) (3)
- [ ] New user (email doesn't exist)
- [ ] Existing user (email exists)
- [ ] Existing user eligible for downgrade

### User States (Manage) (8)
- [ ] Premium user with token
- [ ] Non-premium user with token
- [ ] Investor with token, no subscription
- [ ] Invited investor with token
- [ ] KW user with add-card parameter
- [ ] User login with email/password
- [ ] User login, needs card setup
- [ ] User login, cannot setup card

### Plan Change Scenarios (4)
- [ ] No team → No team (simple upgrade/downgrade)
- [ ] No team → Team plan (team creation)
- [ ] Team plan → No team (team removal)
- [ ] Team plan → Team plan (compatible size)
- [ ] Team plan → Team plan (incompatible - too many users)

### Error Scenarios (6)
- [ ] Card processing error
- [ ] Slug already taken
- [ ] Wrong password
- [ ] Invalid token
- [ ] General API error
- [ ] User doesn't exist

### Edge Cases (8)
- [ ] Slug skip
- [ ] Start over functionality
- [ ] No product parameter (redirect)
- [ ] Product=0 parameter (deprecated - external redirect)
- [ ] Coupon code application
- [ ] Pre-filled email parameter
- [ ] ?mock_purchase=true parameter (testing)
- [ ] Role-based plan change restrictions (AGENT→INVESTOR blocked)
- [ ] Whitelabel filtering in plan changes

---

## Navigation Paths

### Forward Navigation (Happy Paths)
1. Plan → Email → Name → Slug → Broker → Team → Phone → Card → Review → Welcome → Dashboard
2. Plan → Email → Name → Phone → Card → Review → Welcome → Dashboard (Investor)
3. Plan → Email → Name → Phone → Broker → Team → Review → Welcome → Dashboard (Free)
4. Token → Dashboard → Manage Subscription → Update Plan → Confirm Changes → Review → Complete
5. Token → Dashboard → Update Card → Card Updated

### Backward Navigation (Error Recovery)
1. Any step → Error → Start Over → Beginning
2. Card Error → Card Step
3. Slug Taken → Slug Step
4. Wrong Password → Login Step
5. User Exists → Email Step

### Exit Points
1. Welcome → Redirect to Dashboard (with reset token)
2. Dashboard → Return to Dashboard (button click)
3. Card Updated → End (modal close or start over)
4. Setup Complete → End
5. Error → Start Over
6. No product parameter → External redirect

---

## API Endpoints Used

### Subscribe Flow APIs (New User Signup)
- `GET /api/signup/checkuserexists/{email}` - Check if email exists
- `GET /api/signup/checkslugexists/{slug}` - Check if slug is available
- `POST /api/signup/purchase` - Process paid subscription purchase
- `POST /api/signup/purchasefree` - Process free subscription signup
- `POST /api/signup/sendreactivation` - Send reactivation email for downgrade
- `GET /api/signup/products` - Fetch available products from database
- `GET /api/signup/whitelabels` - Fetch whitelabel branding options from database

### Manage Flow APIs (Existing User Management)
- `POST /api/manage/auth/jwt/verify/{token}` - Verify JWT token
- `POST /api/manage/login` - Email/password login
- `GET /api/manage/checkuserexists/{email}` - Check if email exists (manage mode)
- `GET /api/manage/checkslugexists/{slug}` - Check if slug is available (manage mode)
- `GET /api/manage/subscription/single` - Get current subscription details
- `POST /api/manage/checkplan` - Validate plan change
- `POST /api/manage/purchase` - Process plan change or new subscription
- `POST /api/manage/updatecard` - Update payment card on file
- `GET /api/manage/products` - Fetch available products filtered by whitelabel and role
- `GET /api/manage/whitelabels` - Fetch whitelabel branding options from database

### Additional Notes
- All API calls support `?mock_purchase=true` parameter for testing (mocks card charge logic)
- Cookie-based authentication is established after successful signup/login
- Products are fetched dynamically from API and filtered by:
  - User's whitelabel association
  - User's role (AGENT/TEAMOWNER vs INVESTOR)
  - Product availability
- Whitelabel branding (logos, colors, etc.) loaded from database, not hardcoded in components

---

## Key Form Validations

### Email
- Must be valid email format
- Checked against existing users

### Name
- Required (not empty)
- Used to generate suggested slug

### Slug
- Optional (can skip)
- 1-30 characters
- Only alphanumeric and hyphens
- Checked for uniqueness

### Phone
- Minimum 14 characters (formatted)
- Auto-formats as user types: (123) 456-7890

### Password (Manage mode)
- Minimum 4 characters

### Card
- Validated by Square payment form
- Must pass payment processor validation

### Consents
- General consent: Required
- Communication consent: Required
- Investor consent: Required (only for investor flows)

---

## Data Collected Per Flow Type

### Standard Signup
- Email
- Name
- Phone
- Slug (optional)
- Brokerage name
- Team name (optional)
- Card details
- Product selection
- Whitelabel association

### Free Signup
- Email
- Name
- Phone
- Brokerage name
- Team name (optional)
- Product selection (free)
- Whitelabel association
- No card details

### Investor Signup
- Email
- Name
- Phone
- Card details (if paid)
- Product selection (investor)
- Investor consent
- No slug
- No brokerage/team names

### Plan Change
- Existing user data (from token/login)
- New product selection
- Existing card on file used
- No new data collection

### Card Update Only
- New card details
- All other data unchanged

---

---

## Summary of Architectural Changes

### API Route Restructuring
**Previous**: All API calls used `/api/**` pattern
**Current**:
- Signup flows use `/api/signup/**`
- Manage flows use `/api/manage/**`
- Provides clear separation between new user and existing user operations

### Product Management
**Previous**: Products stored in JavaScript file (productsList.js)
**Current**: Products fetched dynamically from API endpoint
- `/api/signup/products` for signup flows
- `/api/manage/products` for manage flows (filtered by whitelabel and role)
- Enables dynamic product management without code changes

### Product-Whitelabel Association
**Previous**: Products could be associated with multiple whitelabels
**Current**: Each product associated with exactly one whitelabel
- Products requiring multiple whitelabel support must be split into separate products
- Simplifies product filtering and management
- Clear one-to-one relationship

### Whitelabel Branding
**Previous**: Hardcoded whitelabel components (logos, colors, etc.)
**Current**: All branding fetched from database via API
- `/api/signup/whitelabels` and `/api/manage/whitelabels`
- No hardcoded components
- Dynamic branding system

### User Roles
**Previous**: `isInvestor` flag sent as parameter
**Current**: Role determined by product selection
- Products specify role at product level (AGENT, TEAMOWNER, INVESTOR)
- No separate isInvestor flag
- Role restrictions enforced in plan changes

### Product Selection Page
**Previous**: `/subscribe?product=0` showed product selection grid
**Current**: Product selection handled externally
- Flow 6 deprecated
- Users must arrive with specific product ID
- If product=0 encountered, redirect to external product selection

### Mock Purchase Testing
**Previous**: No built-in testing mechanism for purchases
**Current**: `?mock_purchase=true` URL parameter
- Mocks card charge logic in backend
- Applies to all purchase and card update operations
- Enables safe testing without real charges

### Authentication System
**Previous**: JWT token-based only
**Current**: Cookie-based authentication
- Cookies established after successful signup/login
- JWT tokens still used for initial manage flow access
- Persistent session management

### Plan Change Restrictions
**Previous**: Users could switch between any compatible plans
**Current**: Role-based restrictions enforced
- AGENT/TEAMOWNER users cannot select INVESTOR products
- INVESTOR users cannot select AGENT/TEAMOWNER products
- Products filtered by user's whitelabel
- Prevents role switching through plan changes

### Key Benefits
1. **Clearer API Structure**: Signup vs Manage routes
2. **Dynamic Product Management**: No code changes for product updates
3. **Flexible Branding**: Database-driven whitelabel system
4. **Role Enforcement**: Prevents unauthorized role switching
5. **Better Testing**: Mock purchase capability
6. **Improved Security**: Cookie-based authentication

---

## End of Documentation

This document represents a complete audit of all user flows in the CashOffers.PRO landing page application as of the current codebase state. Last updated: February 2026 with architectural changes for API restructuring, dynamic product management, and role-based access control.
