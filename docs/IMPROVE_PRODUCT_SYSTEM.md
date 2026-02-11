# Product System Enhancement: User Configuration in Products

## Context

The billing service currently has a disconnect between product purchases and CashOffers user configuration. When users purchase subscriptions, the purchase endpoint accepts an `isInvestor` boolean parameter that is passed through but never used. This creates confusion and requires manual configuration of user properties (is_premium, role, white_label) after purchase.

This plan refactors the system so that:
- Products define the CashOffers user configuration they provide
- Subscriptions copy and can customize this configuration per user
- The purchase flow automatically configures users based on their purchased product
- The legacy `isInvestor` parameter is removed in favor of product-driven configuration

## Key Principles

### When User Updates Occur

The billing service updates users in the main API at these specific times:

1. **Initial Purchase** - New user creation includes product user_config
2. **Subscription Upgrade** - User updated with new product config + role mapping for team transitions
3. **Subscription Downgrade** - User updated with new product config + role mapping for team transitions
4. **Subscription Suspension** - User restored to subscription-defined state

**NOT updated during:**
- Regular subscription renewals (user keeps current state)

### Role Mapping for Plan Transitions

Special rules apply when moving between single and team plans:
- **Single → Team**: Role becomes `teamowner` (regardless of product's base role)
- **Team → Single**: Role becomes `agent` (regardless of product's base role)
- **Same plan type**: Use product's configured role

## Implementation Plan

### Phase 1: Database Schema Enhancement

**No schema changes needed!** The database already has the necessary structure:
- `Products.data` (JSON field) - will store user configuration
- `Subscriptions.data` (JSON field) - will store copied configuration
- `Subscriptions.product_id` - relationship already exists

### Phase 2: Define Product Data Structure

**File:** `api/domain/types/product-data.types.ts` (new file)

Create TypeScript interfaces for the product data JSON structure:

```typescript
export interface ProductUserConfig {
  is_premium: 0 | 1
  role: 'agent' | 'investor' | 'admin' | 'teamowner'
  white_label_id: number | null
  is_team_plan?: boolean  // Indicates if this is a team subscription product
}

export interface ProductData {
  // Existing fields (from current usage)
  signup_fee?: number
  renewal_cost?: number
  duration?: 'daily' | 'weekly' | 'monthly' | 'yearly'

  // New user configuration
  user_config?: ProductUserConfig
}

export interface SubscriptionData {
  // Can include product config plus subscription-specific overrides
  user_config?: ProductUserConfig
}
```

### Phase 3: Update User API Client

**File:** `api/infrastructure/external-api/user-api.interface.ts`

Update `CreateUserRequest` interface to accept user configuration:

```typescript
export interface CreateUserRequest {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  password?: string
  // New fields from product configuration
  is_premium?: 0 | 1
  role?: string
  whitelabel_id?: number
}
```

**File:** `api/infrastructure/external-api/user-api/user-api.client.ts`

Update the `createUser` method (around line 90) to send the new fields to the main API.

### Phase 4: Update Purchase Flow

**File:** `api/use-cases/types/subscription.types.ts`

Remove `isInvestor` from `PurchaseSubscriptionInput` (line 218):

```typescript
export interface PurchaseSubscriptionInput {
  // ... existing fields ...

  // New User Info
  phone?: string
  whitelabel?: string  // Keep for backward compatibility
  slug?: string
  url?: string
  // REMOVED: isInvestor?: boolean

  // Optional
  coupon?: string
  context?: PaymentContext
}
```

**File:** `api/use-cases/subscription/purchase-subscription.use-case.ts`

Update the use case to:
1. Parse product data to extract user configuration (around line 232)
2. Pass user configuration when creating new users (around line 152)
3. Store user configuration in subscription data (around line 284)

Key changes:
- Line 150-160: When creating user, extract `user_config` from product.data and include in createUser call
- Line 284-297: When creating subscription, copy `user_config` from product to subscription.data

Example code for user creation:
```typescript
// Extract user config from product data
const productData = typeof product.data === 'object' && product.data !== null
  ? product.data as ProductData
  : {}
const userConfig = productData.user_config

// Create user in main API with configuration
user = await this.deps.userApiClient.createUser({
  email: validatedInput.email,
  phone: validatedInput.phone,
  is_premium: userConfig?.is_premium,
  role: userConfig?.role,
  whitelabel_id: userConfig?.white_label_id,
})
```

Example code for subscription creation:
```typescript
// Create subscription with user config in data field
const subscription = await this.deps.subscriptionRepository.create({
  user_id: userId,
  subscription_name: product.product_name,
  amount: renewalCost,
  duration: productDuration as "daily" | "weekly" | "monthly" | "yearly",
  status: "active",
  renewal_date: renewalDate,
  product_id: product.product_id,
  square_environment: payment.environment,
  cancel_on_renewal: 0,
  downgrade_on_renewal: 0,
  data: JSON.stringify({ user_config: userConfig }), // Store user config
  createdAt: now,
  updatedAt: now,
})
```

**File:** `api/routes/purchase.ts`

Remove `isInvestor` from request body destructuring (line 28).

**File:** `api/routes/schemas/purchase.schemas.ts`

Remove `isInvestor` from the purchase schema validation.

**File:** `api/use-cases/types/validation.schemas.ts`

Remove `isInvestor` from `PurchaseSubscriptionInputSchema` if present.

### Phase 5: Update Subscription Lifecycle Events

User updates happen at specific lifecycle events, not on regular renewals:

**File:** `api/use-cases/subscription/renew-subscription.use-case.ts`

Regular renewals maintain existing subscription data but DO NOT update the user in main API.

**File:** `api/use-cases/subscription/suspend-subscription.use-case.ts` (may need to create)

When a subscription is suspended (failed payment, cancellation):
1. Read `user_config` from subscription.data
2. Revert user to non-premium state:
   - Set is_premium to 0
   - Downgrade role to a base level (e.g., from teamowner → agent, keep investors as investor)
   - Maintain white_label_id (users stay in their white label even when suspended)
3. This ensures users lose premium features when subscription is suspended but can be restored when they reactivate

**File:** `api/use-cases/subscription/upgrade-subscription.use-case.ts` (may need to create)

When upgrading subscriptions:
1. Get user_config from new product
2. Get user_config from current subscription
3. Use `mapRoleForTransition` to determine correct role:
   ```typescript
   const newRole = mapRoleForTransition({
     fromIsTeamPlan: currentSubscription.data?.user_config?.is_team_plan || false,
     toIsTeamPlan: newProduct.data?.user_config?.is_team_plan || false,
     baseRole: newProduct.data?.user_config?.role || 'agent'
   })
   ```
4. Create new subscription with updated user_config (including mapped role)
5. Update user in main API with new configuration
6. Charge prorated amount for upgrade

**File:** `api/use-cases/subscription/downgrade-subscription.use-case.ts` (may need to create)

When downgrading subscriptions:
1. Get user_config from new product
2. Get user_config from current subscription
3. Use `mapRoleForTransition` to determine correct role (same logic as upgrade)
4. Create new subscription with updated user_config
5. Update user in main API with new configuration

These lifecycle events ensure users stay synchronized with their subscription level.

### Phase 5.1: Special Role Mapping Logic

Create a helper function to determine the correct role when transitioning between subscription types:

**File:** `api/domain/services/role-mapper.ts` (new file)

```typescript
import { ProductUserConfig } from '../types/product-data.types'

export interface RoleTransition {
  fromIsTeamPlan: boolean
  toIsTeamPlan: boolean
  baseRole: string
}

export function mapRoleForTransition(transition: RoleTransition): string {
  const { fromIsTeamPlan, toIsTeamPlan, baseRole } = transition

  // Upgrading to team plan
  if (!fromIsTeamPlan && toIsTeamPlan) {
    return 'teamowner'
  }

  // Downgrading from team plan to single
  if (fromIsTeamPlan && !toIsTeamPlan) {
    return 'agent'
  }

  // No plan type change, use base role from product
  return baseRole
}
```

This function encapsulates the team transition logic:
- Single → Team: role becomes TEAMOWNER
- Team → Single: role becomes AGENT
- Same plan type: use product's configured role

### Phase 6: Add Product Management Endpoints

Create endpoints to manage product user configurations:

**File:** `api/routes/product.ts`

Add ability to update product data including user_config through the existing update endpoint. The endpoint should validate that user_config follows the ProductUserConfig schema.

### Phase 7: Migration Strategy

For existing subscriptions without `data.user_config`:
- **No immediate action needed** - leave these as null
- When they renew, the renewal process will check if subscription.data.user_config is null
- If null, fall back to reading from product.data.user_config
- This provides gradual migration as subscriptions renew

### Phase 8: Documentation

Update `CLAUDE.md` to document:
- Product data structure with user_config
- Subscription data structure
- How user configuration flows from product → subscription → user
- Migration strategy for existing subscriptions

## Critical Files to Modify

### New Files
1. `api/domain/types/product-data.types.ts` - Define ProductUserConfig and ProductData types
2. `api/domain/services/role-mapper.ts` - Role mapping logic for plan transitions
3. `api/use-cases/subscription/suspend-subscription.use-case.ts` - Handle suspension (may need to create)
4. `api/use-cases/subscription/upgrade-subscription.use-case.ts` - Handle upgrades (may need to create)
5. `api/use-cases/subscription/downgrade-subscription.use-case.ts` - Handle downgrades (may need to create)

### Modified Files
6. `api/infrastructure/external-api/user-api.interface.ts` - Update CreateUserRequest with user config fields
7. `api/infrastructure/external-api/user-api/user-api.client.ts` - Update createUser implementation
8. `api/use-cases/types/subscription.types.ts` - Remove isInvestor parameter
9. `api/use-cases/subscription/purchase-subscription.use-case.ts` - Extract and apply product user_config
10. `api/routes/purchase.ts` - Remove isInvestor from request
11. `api/routes/schemas/purchase.schemas.ts` - Update validation schema
12. `api/use-cases/subscription/renew-subscription.use-case.ts` - Ensure renewal doesn't update user

## Validation & Testing

### Manual Testing

#### Test 1: New User Purchase
1. Create a single plan product with user_config:
   ```json
   {
     "signup_fee": 0,
     "renewal_cost": 25000,
     "duration": "monthly",
     "user_config": {
       "is_premium": 1,
       "role": "agent",
       "white_label_id": 1,
       "is_team_plan": false
     }
   }
   ```

2. Purchase as a new user (without isInvestor field)
   - Verify user created in main API with is_premium=1, role="agent", whitelabel_id=1
   - Verify subscription.data contains user_config

#### Test 2: Subscription Renewal
1. Let a subscription renew via cron
   - Verify user in main API is NOT updated
   - Verify subscription.data remains unchanged

#### Test 3: Upgrade to Team Plan
1. Create a team plan product:
   ```json
   {
     "renewal_cost": 50000,
     "duration": "monthly",
     "user_config": {
       "is_premium": 1,
       "role": "agent",
       "white_label_id": 1,
       "is_team_plan": true
     }
   }
   ```

2. Upgrade a single plan user to team plan
   - Verify user role is updated to "teamowner" (not "agent")
   - Verify subscription.data reflects is_team_plan: true
   - Verify prorated charge is applied

#### Test 4: Downgrade from Team to Single
1. Downgrade a team plan user to single plan
   - Verify user role is updated to "agent"
   - Verify subscription.data reflects is_team_plan: false

#### Test 5: Subscription Suspension
1. Suspend a subscription (failed payment, cancellation)
   - Verify user is restored to subscription-defined state
   - Example: If subscription has is_premium=1, user should be downgraded

### Database Verification
- Query Products table to see data field contents
- Query Subscriptions table to see data field copied from product
- Verify old subscriptions with null data still work

### Backward Compatibility
- Existing subscriptions with null data should continue working
- Products without user_config should still allow purchases (user_config optional)
- Main API should handle optional is_premium/role/whitelabel_id fields

## Benefits

1. **Centralized Configuration**: Product defines what the user gets
2. **Flexible Customization**: Subscriptions can override per-user settings
3. **Removes Confusion**: Eliminates unused isInvestor parameter
4. **Gradual Migration**: Existing subscriptions unaffected until renewal
5. **Future-Proof**: Easy to add more configuration fields to user_config
