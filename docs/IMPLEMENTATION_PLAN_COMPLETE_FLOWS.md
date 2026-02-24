# Implementation Plan: Complete 41 User Flow Support with Architectural Modernization

**Created**: February 17, 2026
**Status**: Approved - Ready for Implementation
**Timeline**: 10 weeks
**Plan Location**: This document serves as the master reference for implementing all 41 user flows

---

## Context

The [USER_FLOWS.md](./USER_FLOWS.md) document describes 41 distinct user flows (12 signup, 17 manage, 11 error/edge cases, 1 hidden) that the CashOffers billing system must support. Currently, approximately **60% of these flows are functional**, but several architectural limitations prevent full coverage:

1. **Hardcoded Products**: Frontend uses static `productsList.js` and `productsListInvestor.js` files instead of fetching from the database
2. **Hardcoded Whitelabel Branding**: Logos and CSS themes are hardcoded React components instead of being database-driven
3. **Incomplete API Separation**: Routes are partially separated (`/api/signup/*`, `/api/manage/*`) but some endpoints could be better organized
4. **Missing Role Enforcement**: Users can theoretically switch between AGENT and INVESTOR roles through plan changes (security gap)
5. **Incomplete Cookie Auth**: JWT token verification exists but cookie-based session management has TODOs
6. **Missing Flows**: Several flows completely unimplemented (product=0 redirect, downgrade offers, email-based login, etc.)

**Objective**: Implement all 41 flows while modernizing the architecture to be database-driven, role-restricted, and easily extensible for future products/whitelabels.

---

## Current State Analysis

### Backend (✅ Strengths, ⚠️ Gaps)
- ✅ Products stored in database with `data.user_config` (role, whitelabel, premium status)
- ✅ `/api/signup/*` routes: `purchasefree`, `checkuserexists`, `checkslugexists`
- ✅ `/api/manage/*` routes: `checkplan`, `checktoken`
- ✅ `/api/product/*` endpoints with `user_config` support
- ✅ Auth middleware with capability-based permissions
- ⚠️ No `/api/signup/products` or `/api/manage/products` endpoints for dynamic fetching
- ⚠️ No whitelabel branding API endpoints
- ⚠️ No `?mock_purchase=true` parameter support
- ⚠️ Cookie authentication incomplete (TODOs in `manage.ts:124`)
- ⚠️ No role validation in plan change endpoints

### Frontend (✅ Strengths, ⚠️ Gaps)
- ✅ Clean flow orchestration with `SubscribeFlow.tsx` and `ManageFlow.tsx`
- ✅ Step transition system with GSAP animations (`useStepTransition`)
- ✅ React Hook Form with Zod validation
- ✅ Whitelabel theming with CSS variables
- ⚠️ Products hardcoded in `/components/data/productsList.js` (37 products)
- ⚠️ Investor products hardcoded in `/components/data/productsListInvestor.js` (2 products)
- ⚠️ Logo components hardcoded (KWLogo, YHSLogo, UCOLogo, etc.)
- ⚠️ `isInvestor` flag used instead of deriving role from product
- ⚠️ No product=0 redirect handling
- ⚠️ Missing several flow steps (downgrade offer, email login, etc.)

---

## Implementation Strategy

### Phase 1: Backend API Foundation (Week 1-2)
**Goal**: Complete API separation, add missing endpoints, implement cookie auth, enable role enforcement

#### 1.1 Complete API Namespace Separation

**File: `api/routes/signup.ts`**
Add 3 new endpoints:
```typescript
POST /api/signup/sendreactivation  // For Flow 21 (downgrade offer)
GET /api/signup/products           // Fetch products filtered by ?whitelabel={code}
GET /api/signup/whitelabels        // Fetch all whitelabel branding data
```

**File: `api/routes/auth.ts`** (some endpoints may already exist)
Add/verify auth endpoints:
```typescript
POST /api/auth/jwt/verify/:token   // Rename from /api/manage/checktoken (if needed)
POST /api/auth/login               // Email/password authentication (may already exist)
POST /api/auth/logout              // Already exists
```

**File: `api/routes/manage.ts`**
Add 5 new endpoints:
```typescript
GET /api/manage/checkuserexists/:email   // Separate from signup version
GET /api/manage/checkslugexists/:slug    // Separate from signup version
GET /api/manage/subscription/single      // Get user's current subscription
POST /api/manage/purchase                // Plan changes for existing users
POST /api/manage/updatecard              // Update card on file
GET /api/manage/products                 // Fetch products filtered by user's role + whitelabel
GET /api/manage/whitelabels              // Fetch whitelabel branding
```

**File: `api/routes/purchase.ts`**
- Keep `/api/purchase` as-is (used for new subscriptions)
- Add cookie setting after successful purchase

#### 1.2 Implement Complete Cookie-Based Authentication

**File: `api/middleware/authMiddleware.ts`**
Enhance to check both `x-api-token` header AND `_api_token` cookie:
```typescript
const token = c.req.header('x-api-token') || getCookie(c, '_api_token')
```

**Files: `api/routes/signup.ts`, `api/routes/purchase.ts`, `api/routes/auth.ts`**
After successful purchase/login, set cookie:
```typescript
setCookie(c, '_api_token', apiToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30 // 30 days
})
```

Apply to:
- `POST /api/purchase` (after successful purchase)
- `POST /api/signup/purchasefree` (after free signup)
- `POST /api/auth/jwt/verify/:token` (after token validation)
- `POST /api/auth/login` (after password authentication - may already exist)

#### 1.3 Add Role-Based Product Filtering

**File: `api/routes/signup.ts` - `GET /api/signup/products`**
```typescript
// Filter by whitelabel only (no user context)
const whitelabelId = whitelabelIds[query.whitelabel || 'default']
const products = await productRepo.findAll()
  .where('data->user_config->whitelabel_id', '=', whitelabelId)
  .where('active', '=', 1)
```

**File: `api/routes/manage.ts` - `GET /api/manage/products`**
```typescript
// Filter by user's whitelabel AND role compatibility
const user = c.get('user') // From auth middleware
const compatibleRoles = ['AGENT', 'TEAMOWNER'].includes(user.role)
  ? ['AGENT', 'TEAMOWNER']
  : ['INVESTOR']

const products = await productRepo.findAll()
  .where('data->user_config->whitelabel_id', '=', user.whitelabel_id)
  .where('data->user_config->role', 'in', compatibleRoles)
  .where('active', '=', 1)
```

**File: `api/routes/manage.ts` - `POST /api/manage/checkplan`**
Add role validation:
```typescript
const newProduct = await productRepo.findById(productID)
const userIsAgentType = ['AGENT', 'TEAMOWNER'].includes(user.role)
const productIsAgentType = ['AGENT', 'TEAMOWNER'].includes(newProduct.data?.user_config?.role)

if (userIsAgentType !== productIsAgentType) {
  return c.json({
    success: 'error',
    error: 'Cannot switch between AGENT and INVESTOR roles',
    code: 'ROLE_INCOMPATIBLE'
  }, 400)
}
```

#### 1.4 Add Mock Purchase Parameter Support

**File: `api/middleware/paymentContextMiddleware.ts`** (NEW)
```typescript
export const paymentContextMiddleware = async (c, next) => {
  const mockPurchase = c.req.query('mock_purchase') === 'true'
  c.set('paymentContext', {
    testMode: mockPurchase || process.env.NODE_ENV === 'test',
    environment: mockPurchase ? 'sandbox' : 'production'
  })
  await next()
}
```

Apply middleware to:
- `POST /api/purchase`
- `POST /api/manage/purchase`
- `POST /api/manage/updatecard`

**File: `api/infrastructure/payment/square-payment-provider.ts`**
Check `context.testMode` and use Square sandbox when true.

#### 1.5 Add Whitelabel Branding API

**File: `api/routes/signup.ts` and `api/routes/manage.ts`**
```typescript
GET /api/signup/whitelabels
GET /api/manage/whitelabels

// Returns:
{
  "success": "success",
  "data": [
    {
      "id": 2,
      "code": "kw",
      "name": "Keller Williams",
      "primary_color": "#D4002A",
      "secondary_color": "#000000",
      "logo_url": "/assets/logos/kw-logo.png"
    }
  ]
}
```

**Note**: Requires database migration to add `data` JSON field to Whitelabels table (see Phase 4).

---

### Phase 2: Frontend Dynamic System (Week 3-5)
**Goal**: Replace hardcoded products/whitelabels with API-driven system

#### 2.1 Create Product Context Provider

**File: `providers/ProductProvider.tsx`** (NEW)
```typescript
'use client'

interface ProductContextType {
  products: Product[]
  loading: boolean
  error: string | null
  getProductById: (id: number | string) => Product | undefined
}

export function ProductProvider({
  children,
  whitelabel,
  mode
}: {
  children: React.ReactNode
  whitelabel?: string
  mode: 'signup' | 'manage'
}) {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    const endpoint = mode === 'signup'
      ? `/api/signup/products?whitelabel=${whitelabel}`
      : `/api/manage/products` // Server-side filtered by role

    fetch(endpoint, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProducts(data.data))
  }, [whitelabel, mode])

  return <ProductContext.Provider value={{products, ...}}>
    {children}
  </ProductContext.Provider>
}

export const useProducts = () => useContext(ProductContext)
```

#### 2.2 Create Whitelabel Context Provider

**File: `providers/WhitelabelProvider.tsx`** (NEW)
```typescript
'use client'

interface WhitelabelContextType {
  whitelabels: Whitelabel[]
  currentWhitelabel: Whitelabel | null
  loading: boolean
  setWhitelabelByCode: (code: string) => void
}

export function WhitelabelProvider({
  children,
  initialWhitelabel = 'default'
}: {
  children: React.ReactNode
  initialWhitelabel?: string
}) {
  const [whitelabels, setWhitelabels] = useState<Whitelabel[]>([])
  const [currentWhitelabel, setCurrentWhitelabel] = useState<Whitelabel | null>(null)

  useEffect(() => {
    fetch('/api/signup/whitelabels')
      .then(res => res.json())
      .then(data => {
        setWhitelabels(data.data)
        const initial = data.data.find(wl => wl.code === initialWhitelabel)
        setCurrentWhitelabel(initial || data.data[0])
      })
  }, [initialWhitelabel])

  return <WhitelabelContext.Provider value={{whitelabels, currentWhitelabel, ...}}>
    {children}
  </WhitelabelContext.Provider>
}

export const useWhitelabel = () => useContext(WhitelabelContext)
```

#### 2.3 Refactor Page Components to Use Providers

**File: `app/(forms)/subscribe/page.tsx`**
```typescript
import { ProductProvider } from '@/providers/ProductProvider'
import { WhitelabelProvider } from '@/providers/WhitelabelProvider'
import { redirect } from 'next/navigation'

export default function SubscribePage({ searchParams }) {
  const whitelabel = searchParams.w || 'default'
  const product = searchParams.product

  // Flow 6: Handle product=0 (deprecated)
  if (product === '0') {
    const redirectUrl = whitelabel === 'yhs'
      ? 'https://www.instantofferspro.com/yhs'
      : 'https://www.instantofferspro.com/agents'
    redirect(redirectUrl)
  }

  // Flow 35, 38-39: Handle missing product
  if (!product) {
    const redirectUrl = whitelabel === 'yhs'
      ? 'https://www.instantofferspro.com/yhs'
      : 'https://www.instantofferspro.com/agents'
    redirect(redirectUrl)
  }

  return (
    <WhitelabelProvider initialWhitelabel={whitelabel}>
      <ProductProvider whitelabel={whitelabel} mode="signup">
        <SubscribePageClient {...} />
      </ProductProvider>
    </WhitelabelProvider>
  )
}
```

**File: `app/(forms)/manage/page.tsx`**
```typescript
export default function ManagePage({ searchParams }) {
  return (
    <WhitelabelProvider initialWhitelabel="default">
      <ProductProvider mode="manage">
        <ManagePageClient {...} />
      </ProductProvider>
    </WhitelabelProvider>
  )
}
```

#### 2.4 Refactor Flow Components to Use Dynamic Products

**File: `components/forms/subscribe/SubscribeFlow.tsx`**
```typescript
import { useProducts } from '@/providers/ProductProvider'
import { useWhitelabel } from '@/providers/WhitelabelProvider'

export default function SubscribeFlow({ initialProduct, whitelabel, coupon }) {
  const { getProductById, loading, error } = useProducts()
  const { currentWhitelabel } = useWhitelabel()

  // Derive role from product data (remove hardcoded isInvestor)
  const selectedProduct = getProductById(initialProduct)
  const isInvestor = selectedProduct?.data?.user_config?.role === 'INVESTOR'

  // Update form defaultValues
  const form = useForm<SubscribeFormData>({
    defaultValues: {
      product: initialProduct,
      whitelabel: whitelabel !== 'default' ? whitelabel : null,
      name_broker: whitelabel === 'kw' ? 'Keller Williams' : null,
      // Remove isInvestor flag - derive from product
    },
  })

  // Use selectedProduct data in ReviewStep
}
```

**File: `components/forms/subscribe/steps/ReviewStep.tsx`**
```typescript
import { useProducts } from '@/providers/ProductProvider'

export default function ReviewStep({ product, formData, onSubmit }) {
  const { getProductById } = useProducts()
  const productData = getProductById(product)

  const monthlyPrice = productData?.data?.renewal_cost || 0
  const signupFee = productData?.data?.signup_fee || 0
  const isInvestor = productData?.data?.user_config?.role === 'INVESTOR'

  // Use productData instead of hardcoded productsList
}
```

#### 2.5 Delete Hardcoded Product Files

**Files to DELETE**:
- `components/data/productsList.js`
- `components/data/productsListInvestor.js`

**Files to UPDATE** (remove imports):
- `components/forms/subscribe/SubscribeFlow.tsx`
- `components/forms/subscribe/steps/ReviewStep.tsx`
- Any other files importing these lists

---

### Phase 3: Missing Flow Implementation (Week 6-7)
**Goal**: Implement the 15+ flows that are currently 0-50% complete

#### 3.1 Flow 6 (Product=0 Redirect) - CRITICAL
✅ Implemented in Phase 2.3 (`app/(forms)/subscribe/page.tsx`)

#### 3.2 Flow 21 (Offer Downgrade) - HIGH PRIORITY

**File: `api/routes/signup.ts`**
```typescript
POST /api/signup/sendreactivation
Body: { email: string }
Logic:
1. Verify user exists and can downgrade (is_premium && !active)
2. Generate reactivation token
3. Send email via sendEmail util
4. Return { success: 'success', message: 'Email sent' }
```

**File: `components/forms/subscribe/steps/EmailStep.tsx`**
```typescript
// After checkuserexists returns offerDowngrade: true
if (response.offerDowngrade) {
  transitionToStep('offerDowngrade')
}
```

**File: `components/forms/subscribe/steps/OfferDowngradeStep.tsx`** (NEW)
```typescript
export default function OfferDowngradeStep({ email, onConfirm }) {
  const mutation = useMutation({
    mutationFn: async () => {
      return axios.post('/api/signup/sendreactivation', { email })
    },
    onSuccess: () => {
      transitionToStep('offerDowngradeConfirm')
    }
  })

  return (
    <div>
      <h3>Reactivate Account</h3>
      <p>Do you want to reactivate your account as a freemium user?</p>
      <Button onClick={() => mutation.mutate()}>Yes, Reactivate</Button>
    </div>
  )
}
```

#### 3.3 Flows 22-25 (Email-Based Login) - HIGH PRIORITY

**File: `api/routes/auth.ts`** (may already exist)
```typescript
POST /api/auth/login
Body: { email: string, password: string }
Logic:
1. Proxy to auth V2 API (implementation may already exist)
2. Extract _api_token from response
3. Set cookie on response
4. Return user data
```

**File: `components/forms/manage/ManageFlow.tsx`**
Add step after email:
```typescript
case 'password': return <PasswordStep onSubmit={handleLogin} />
```

**File: `components/forms/manage/steps/PasswordStep.tsx`** (NEW)
```typescript
export default function PasswordStep({ onSubmit }) {
  const mutation = useMutation({
    mutationFn: async (password: string) => {
      return axios.post('/api/auth/login', { email, password })
    },
    onSuccess: (data) => {
      onSubmit(data.user)
    },
    onError: (error) => {
      if (error.response?.data?.code === 'PWINVALID') {
        setError('Incorrect password')
      }
    }
  })

  return <PasswordInput onSubmit={mutation.mutate} />
}
```

#### 3.4 Flow 14 (Update Billing Card) - MEDIUM PRIORITY

**File: `api/routes/manage.ts`**
```typescript
POST /api/manage/updatecard
Body: { card_token: string, exp_month: number, exp_year: number }
Logic:
1. Get user from auth middleware
2. Find user's existing card
3. Update card via Square API
4. Update UserCards table
5. Return { success: 'success' }
```

**File: `components/forms/manage/steps/CardStep.tsx`**
Update to handle both initial card and update card modes.

#### 3.5 Flow 15 (Manage Subscription View) - MEDIUM PRIORITY

**File: `api/routes/manage.ts`**
```typescript
GET /api/manage/subscription/single
Logic:
1. Get user from auth middleware
2. Find active subscription for user
3. Join with Products table
4. Return subscription with product details
```

**File: `components/forms/manage/steps/SubscriptionStep.tsx`** (NEW)
```typescript
export default function SubscriptionStep({ onChangePlan, onBack }) {
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await axios.get('/api/manage/subscription/single')
      return res.data.data
    }
  })

  return (
    <div>
      <h3>Your Subscription</h3>
      <p>Plan: {subscription?.product?.product_name}</p>
      <p>Monthly: ${subscription?.amount / 100}</p>
      <p>Renewal: {subscription?.renewal_date}</p>
      <Button onClick={onChangePlan}>Change Plan</Button>
      <Button onClick={onBack}>Back</Button>
    </div>
  )
}
```

#### 3.6 Flows 16-18 (Change Plan) - HIGH PRIORITY

**File: `api/routes/manage.ts`**
```typescript
POST /api/manage/purchase
Body: { product_id: number, subscription_id: number }
Logic:
1. Get user from auth middleware
2. Validate role compatibility (same as checkplan)
3. Calculate prorated charge
4. Process payment if needed
5. Update subscription to new product
6. Update user config if needed
7. Return { success: 'success', data: { subscription, charge } }
```

**File: `components/forms/manage/steps/UpdatePlanStep.tsx`** (NEW)
```typescript
import { useProducts } from '@/providers/ProductProvider'

export default function UpdatePlanStep({ currentSubscription, onNext }) {
  const { products, loading } = useProducts() // Already filtered by role!

  // Filter out current plan and free plans
  const availablePlans = products.filter(p =>
    p.product_id !== currentSubscription.product_id &&
    p.product_id !== 'free' &&
    p.product_id !== 'freeinvestor'
  )

  return (
    <div>
      {availablePlans.map(product => (
        <PlanCard
          key={product.product_id}
          product={product}
          onClick={() => onNext(product.product_id)}
        />
      ))}
    </div>
  )
}
```

---

### Phase 4: Database Enhancements (Week 8)
**Goal**: Add whitelabel branding data storage

#### 4.1 Migration: Add Whitelabel Branding

**File: `api/database/migrations/005_add_whitelabel_branding.sql`** (NEW)
```sql
-- Add branding data to Whitelabels table
ALTER TABLE Whitelabels
ADD COLUMN data JSON NULL AFTER suspension_behavior;

-- Seed branding data for existing whitelabels
UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#D4002A',
  'secondary_color', '#000000',
  'logo_url', '/assets/logos/kw-logo.png'
) WHERE code = 'kw';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#164d86',
  'secondary_color', '#b12029',
  'logo_url', '/assets/logos/yhs-logo.png'
) WHERE code = 'yhs';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#164d86',
  'secondary_color', '#c20f19',
  'logo_url', '/assets/logos/uco-logo.png'
) WHERE code = 'uco';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/mop-logo.png'
) WHERE code = 'mop';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/eco-logo.png'
) WHERE code = 'eco';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/platinum-logo.png'
) WHERE code = 'platinum';

UPDATE Whitelabels SET data = JSON_OBJECT(
  'primary_color', '#4d9cb9',
  'secondary_color', '#ec8b33',
  'logo_url', '/assets/logos/default-logo.png'
) WHERE code = 'default';
```

#### 4.2 Run Kysely Codegen

```bash
npm run codegen
```

This updates `api/lib/db.d.ts` with new Whitelabels.data field.

---

### Phase 5: Testing & Verification (Week 9-10)
**Goal**: Verify all 41 flows work correctly

#### 5.1 Create E2E Test Suite

**File: `tests/e2e/signup-flows.test.ts`** (NEW)
```typescript
describe('Signup Flows (1-12)', () => {
  test('Flow 1: Standard Paid Plan Signup', async () => {
    await page.goto('/subscribe?product=1')
    await fillEmail('test@example.com')
    await fillName('John Doe')
    await fillSlug('johndoe')
    await fillBroker('Test Brokerage')
    await fillPhone('(555) 123-4567')
    await fillCard('4111111111111111', '12', '2025')
    await clickReview()
    await checkConsents()
    await clickSubmit()
    await expect(page).toHaveURL(/welcome/)
    // Verify cookie is set
    const cookies = await page.context().cookies()
    expect(cookies.find(c => c.name === '_api_token')).toBeDefined()
  })

  test('Flow 2: Free Plan Signup', async () => {
    await page.goto('/subscribe?product=free')
    // No card step
    // Verify welcome page
  })

  test('Flow 6: Product=0 Redirect', async () => {
    await page.goto('/subscribe?product=0')
    await expect(page).toHaveURL(/instantofferspro\.com/)
  })

  // ... 9 more tests for flows 3-5, 7-12
})

describe('Manage Flows (13-29)', () => {
  test('Flow 13: Token-Based Dashboard Access', async () => {
    const token = generateTestJWT({ id: 1, email: 'test@example.com' })
    await page.goto(`/manage?t=${token}`)
    await expect(page.locator('text=Update Your Billing Info')).toBeVisible()
    await expect(page.locator('text=Manage Your Subscription')).toBeVisible()
  })

  test('Flow 16: Change Plan - No Team', async () => {
    await loginAsUser('premium@example.com')
    await page.goto('/manage')
    await clickManageSubscription()
    await clickChangePlan()
    // Verify only role-compatible plans shown
    await expect(page.locator('[data-product-id="11"]')).not.toBeVisible() // Investor plan hidden for agents
  })

  // ... 15 more tests for flows 14-15, 17-29
})

describe('Error Flows (30-34)', () => {
  test('Flow 30: Card Processing Error', async () => {
    await page.goto('/subscribe?product=1')
    await fillAllFields()
    await fillCard('4000000000000002') // Declined card
    await clickSubmit()
    await expect(page.locator('text=unable to process your Card')).toBeVisible()
  })

  // ... 4 more tests for flows 31-34
})
```

#### 5.2 Manual Testing Checklist

Create testing matrix covering:
- **7 Whitelabels** × **5 Product Types** × **3 User States** = 105 combinations
- Focus on critical paths:
  - Standard signup → paid plan → dashboard
  - Token access → plan change → verify role restrictions
  - Email login → card update → success
  - Product=0 → external redirect
  - Mock purchase → verify no real charge

#### 5.3 Verification Checklist

After implementation, verify:

✅ **API Endpoints**:
- [ ] `GET /api/signup/products?whitelabel=kw` returns KW products only
- [ ] `GET /api/manage/products` returns role-compatible products only
- [ ] `GET /api/signup/whitelabels` returns branding data
- [ ] `POST /api/purchase?mock_purchase=true` uses sandbox
- [ ] `POST /api/manage/purchase` rejects role-incompatible plans
- [ ] `POST /api/auth/login` sets cookie and returns user data
- [ ] `POST /api/auth/jwt/verify/:token` validates token and sets cookie

✅ **Frontend**:
- [ ] Products load from API, not hardcoded files
- [ ] Whitelabel branding loads from API
- [ ] Logo components render dynamically
- [ ] CSS colors apply from API data
- [ ] `productsList.js` deleted
- [ ] `productsListInvestor.js` deleted

✅ **Authentication**:
- [ ] `_api_token` cookie set after signup
- [ ] `_api_token` cookie set after login
- [ ] Cookie persists across page loads
- [ ] Auth middleware accepts both header and cookie

✅ **Role Enforcement**:
- [ ] AGENT user cannot see INVESTOR products in plan change
- [ ] INVESTOR user cannot see AGENT products in plan change
- [ ] Backend rejects role-incompatible plan changes

✅ **Flows**:
- [ ] All 12 signup flows work
- [ ] All 17 manage flows work
- [ ] All 11 error flows work
- [ ] Flow 6 (product=0) redirects correctly
- [ ] Flow 21 (downgrade offer) sends reactivation email

---

## Critical Files to Modify

### Backend (9 files)
1. **`api/routes/signup.ts`** - Add 3 endpoints (sendreactivation, products, whitelabels)
2. **`api/routes/auth.ts`** - Add/verify 1 endpoint (jwt/verify, login may exist)
3. **`api/routes/manage.ts`** - Add 5 endpoints (checkuserexists, checkslugexists, subscription/single, purchase, updatecard, products, whitelabels)
4. **`api/routes/purchase.ts`** - Add cookie setting after successful purchase
5. **`api/middleware/authMiddleware.ts`** - Add cookie support
6. **`api/middleware/paymentContextMiddleware.ts`** (NEW) - Mock purchase detection
7. **`api/infrastructure/payment/square-payment-provider.ts`** - Check testMode flag
8. **`api/database/migrations/005_add_whitelabel_branding.sql`** (NEW) - Add data field to Whitelabels
9. **`api/lib/db.d.ts`** - Regenerate with `npm run codegen`

### Frontend (13 files)
1. **`providers/ProductProvider.tsx`** (NEW) - Dynamic product fetching
2. **`providers/WhitelabelProvider.tsx`** (NEW) - Dynamic whitelabel branding
3. **`app/(forms)/subscribe/page.tsx`** - Add providers, handle product=0 redirect
4. **`app/(forms)/manage/page.tsx`** - Add providers
5. **`components/forms/subscribe/SubscribeFlow.tsx`** - Use useProducts hook
6. **`components/forms/subscribe/steps/ReviewStep.tsx`** - Use useProducts hook
7. **`components/forms/manage/ManageFlow.tsx`** - Use useProducts hook
8. **`components/forms/manage/steps/PasswordStep.tsx`** (NEW) - Email login
9. **`components/forms/manage/steps/SubscriptionStep.tsx`** (NEW) - View subscription
10. **`components/forms/manage/steps/UpdatePlanStep.tsx`** (NEW) - Change plan
11. **`components/forms/subscribe/steps/OfferDowngradeStep.tsx`** (NEW) - Downgrade offer
12. **`components/data/productsList.js`** - DELETE
13. **`components/data/productsListInvestor.js`** - DELETE

---

## Success Criteria

✅ **Functional**: All 41 flows pass E2E tests
✅ **Security**: Role-based restrictions enforced (AGENT ↔ INVESTOR blocking)
✅ **Performance**: Product/whitelabel fetching < 200ms
✅ **Maintainability**: No hardcoded products or whitelabels
✅ **Extensibility**: Adding new products/whitelabels requires only database changes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing flows | Keep `/api/purchase` at root level; test thoroughly before deployment |
| Cookie auth issues | Support both header and cookie auth during transition |
| Role validation bypassed | Backend enforcement in both checkplan AND purchase endpoints |
| Whitelabel branding not loading | Fallback to default branding, cache in localStorage |
| Performance degradation | Cache products/whitelabels in context, re-fetch only on param change |

---

## Timeline

- **Week 1-2**: Backend API (Phase 1) - 9 files
- **Week 3-4**: Frontend Infrastructure (Phase 2) - ProductProvider, WhitelabelProvider
- **Week 5**: Frontend Refactoring (Phase 2 cont.) - Integrate providers, delete hardcoded files
- **Week 6-7**: Missing Flows (Phase 3) - Implement 15+ flows
- **Week 8**: Database & Testing (Phase 4-5) - Migration, E2E tests
- **Week 9-10**: Verification & Bug Fixes

**Total**: 10 weeks for complete implementation

---

## Implementation Progress Tracking

Use this section to track progress as implementation proceeds:

### Phase 1: Backend API Foundation
- [ ] 1.1 API Namespace Separation
- [ ] 1.2 Cookie-Based Authentication
- [ ] 1.3 Role-Based Product Filtering
- [ ] 1.4 Mock Purchase Parameter Support
- [ ] 1.5 Whitelabel Branding API

### Phase 2: Frontend Dynamic System
- [ ] 2.1 Product Context Provider
- [ ] 2.2 Whitelabel Context Provider
- [ ] 2.3 Page Components Refactor
- [ ] 2.4 Flow Components Refactor
- [ ] 2.5 Delete Hardcoded Files

### Phase 3: Missing Flow Implementation
- [ ] 3.1 Flow 6 (Product=0 Redirect)
- [ ] 3.2 Flow 21 (Offer Downgrade)
- [ ] 3.3 Flows 22-25 (Email-Based Login)
- [ ] 3.4 Flow 14 (Update Billing Card)
- [ ] 3.5 Flow 15 (Manage Subscription View)
- [ ] 3.6 Flows 16-18 (Change Plan)

### Phase 4: Database Enhancements
- [ ] 4.1 Migration: Add Whitelabel Branding
- [ ] 4.2 Run Kysely Codegen

### Phase 5: Testing & Verification
- [x] 5.1 Create E2E Test Suite ✅ Complete (Feb 24, 2026)
- [x] 5.2 Manual Testing Checklist ✅ Complete (Feb 24, 2026)
- [x] 5.3 Verification Checklist ✅ Complete (Feb 24, 2026)

---

## Related Documentation

- [USER_FLOWS.md](./USER_FLOWS.md) - Complete description of all 41 user flows
- [CLAUDE.md](../CLAUDE.md) - Project overview and development guidelines
- [IMPROVE_PRODUCT_SYSTEM.md](./IMPROVE_PRODUCT_SYSTEM.md) - Product-driven user configuration details
- [PHASE_5_COMPLETION_SUMMARY.md](./PHASE_5_COMPLETION_SUMMARY.md) - Phase 5 testing implementation summary
- [MANUAL_TESTING_CHECKLIST.md](./MANUAL_TESTING_CHECKLIST.md) - Manual testing guide
- [VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md) - Complete verification checklist
- [E2E Testing README](../tests/e2e/README.md) - E2E test suite documentation

---

**Last Updated**: February 24, 2026
**Status**: Phase 5 Complete - Ready for Testing Execution
