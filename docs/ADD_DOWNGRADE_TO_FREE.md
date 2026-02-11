# Implementation Plan: Whitelabel-Specific Suspension Behavior

## Context

Currently, when a subscription is suspended, the system always downgrades the user to free status (sets `is_premium = 0`) via the `PremiumDeactivationHandler`. However, different white labels have different business requirements:

- **Some white labels** want to downgrade users to free status (`is_premium: 1 → 0`) while keeping them active - allowing continued limited access
- **Other white labels** want to fully deactivate users (`active: 1 → 0`) when their subscription is suspended - preventing any access

This change adds a configurable `suspension_behavior` field to the `Whitelabels` table that determines which action to take during subscription suspension.

## Implementation Approach

### 1. Database Schema Change

**Add `suspension_behavior` field to Whitelabels table**

Create migration: `api/database/migrations/003_add_whitelabel_suspension_behavior.sql`

```sql
ALTER TABLE Whitelabels
ADD COLUMN suspension_behavior ENUM('DOWNGRADE_TO_FREE', 'DEACTIVATE_USER')
NOT NULL
DEFAULT 'DOWNGRADE_TO_FREE'
AFTER name;

CREATE INDEX idx_whitelabels_suspension_behavior ON Whitelabels(suspension_behavior);

UPDATE Whitelabels
SET suspension_behavior = 'DOWNGRADE_TO_FREE'
WHERE suspension_behavior IS NULL;
```

After migration, run: `npm run codegen` to regenerate Kysely types.

### 2. Create Whitelabel Repository

**New files:**
- `api/infrastructure/database/repositories/whitelabel.repository.interface.ts`
- `api/infrastructure/database/repositories/whitelabel.repository.ts`

Follow the existing repository pattern (see `product.repository.ts` for reference).

**Key method:**
```typescript
getSuspensionBehavior(whitelabelId: number): Promise<'DOWNGRADE_TO_FREE' | 'DEACTIVATE_USER' | null>
```

Note: `DOWNGRADE_TO_FREE` sets `is_premium = 0`, `DEACTIVATE_USER` sets `active = 0`.

### 3. Extend User API Client

**Modify:** `api/infrastructure/external-api/user-api.interface.ts`

Add interface method:
```typescript
deactivateUser(userId: number): Promise<void>
```

**Modify:** `api/infrastructure/external-api/user-api/user-api.client.ts`

Implement the method (similar to `deactivateUserPremium` but sets `active: false`).

### 4. Update Premium Deactivation Handler

**Modify:** `api/application/event-handlers/premium-deactivation.handler.ts`

**Changes:**
1. Add dependencies: `IWhitelabelRepository` and `ISubscriptionRepository` to constructor
2. Add new private method: `deactivateUserByWhitelabelConfig(userId, subscriptionId)`
3. Update `handleSubscriptionPaused` and `handleSubscriptionDeactivated` to call the new method

**Logic flow:**
1. Fetch subscription by `subscriptionId`
2. Parse `subscription.data` to extract `user_config.whitelabel_id`
3. If no whitelabel_id → default to `DOWNGRADE_TO_FREE`
4. Query whitelabel repository for `suspension_behavior`
5. If `DEACTIVATE_USER` → call `userApiClient.deactivateUser(userId)` (sets active = 0)
6. If `DOWNGRADE_TO_FREE` or null → call `userApiClient.deactivateUserPremium(userId)` (sets is_premium = 0)

**Fallback behavior:** Any error or missing data defaults to existing behavior (downgrade to free).

### 5. Update Dependency Injection Container

**Modify:** `api/container.ts`

**Changes:**
1. Import whitelabel repository factory and interface
2. Add to `IContainer.repositories`:
   ```typescript
   whitelabel: IWhitelabelRepository
   ```
3. Create repository instance:
   ```typescript
   whitelabel: createWhitelabelRepository(db)
   ```
4. Update `PremiumDeactivationHandler` instantiation to inject new dependencies:
   ```typescript
   new PremiumDeactivationHandler(
     services.userApi,
     repositories.whitelabel,      // NEW
     repositories.subscription,     // NEW
     logger
   )
   ```

## Critical Files to Modify

1. **Database:**
   - `api/database/migrations/003_add_whitelabel_suspension_behavior.sql` (NEW)
   - `api/lib/db.d.ts` (regenerated via `npm run codegen`)

2. **Repository Layer:**
   - `api/infrastructure/database/repositories/whitelabel.repository.interface.ts` (NEW)
   - `api/infrastructure/database/repositories/whitelabel.repository.ts` (NEW)

3. **User API Client:**
   - `api/infrastructure/external-api/user-api.interface.ts` (MODIFY - add interface method)
   - `api/infrastructure/external-api/user-api/user-api.client.ts` (MODIFY - implement method)

4. **Event Handler:**
   - `api/application/event-handlers/premium-deactivation.handler.ts` (MODIFY - add whitelabel logic)

5. **Dependency Injection:**
   - `api/container.ts` (MODIFY - wire up whitelabel repository)

## Implementation Sequence

1. **Database Migration**
   - Create SQL migration file
   - Apply to development database
   - Run `npm run codegen` to regenerate types
   - Verify `Whitelabels` interface in `db.d.ts` includes `suspension_behavior`

2. **Repository Layer**
   - Create whitelabel repository interface
   - Create whitelabel repository implementation
   - Follow pattern from `product.repository.ts`

3. **User API Extension**
   - Add `deactivateUser` method to interface
   - Implement in UserApiClient (similar to `deactivateUserPremium`)

4. **Handler Logic**
   - Back up original handler file
   - Add new dependencies to constructor
   - Implement `deactivateUserByWhitelabelConfig` method
   - Update event handler methods to call new logic
   - Ensure proper error handling and fallbacks

5. **Dependency Injection**
   - Import whitelabel repository
   - Add to container interface and implementation
   - Update handler instantiation with new dependencies

6. **Verification** (see below)

## Verification Steps

### 1. Database Verification
```bash
# After migration
npm run codegen

# Check types
grep -A 5 "export interface Whitelabels" api/lib/db.d.ts
# Should show: suspension_behavior: "DOWNGRADE_TO_FREE" | "DEACTIVATE_USER"
```

### 2. TypeScript Compilation
```bash
npm run build
# Should compile without errors
```

### 3. Test Whitelabel Repository
```bash
# Create unit test or manual test
npx vitest run api/tests/unit/whitelabel.repository.test.ts
```

### 4. Integration Testing

**Test Case 1: DOWNGRADE_TO_FREE (default behavior - keeps user active)**
1. Create/update a whitelabel: `suspension_behavior = 'DOWNGRADE_TO_FREE'`
2. Create product with `user_config.whitelabel_id` pointing to this whitelabel
3. Purchase subscription for a user
4. Pause the subscription via API
5. Verify in main API: User has `is_premium = 0`, `active = 1` (downgraded to free, still active)

**Test Case 2: DEACTIVATE_USER (new behavior - full deactivation)**
1. Create/update a whitelabel: `suspension_behavior = 'DEACTIVATE_USER'`
2. Create product with `user_config.whitelabel_id` pointing to this whitelabel
3. Purchase subscription for a user
4. Pause the subscription via API
5. Verify in main API: User has `active = 0` (completely deactivated)

**Test Case 3: Fallback (no whitelabel - uses default)**
1. Create product without `user_config.whitelabel_id`
2. Purchase and pause subscription
3. Verify: Falls back to `DOWNGRADE_TO_FREE` behavior (`is_premium = 0`, `active = 1`)

**SQL for test setup:**
```sql
-- Create test whitelabels
INSERT INTO Whitelabels (code, name, suspension_behavior) VALUES
  ('TEST_FREE', 'Test Downgrade to Free', 'DOWNGRADE_TO_FREE'),
  ('TEST_DEACTIVATE', 'Test Full Deactivation', 'DEACTIVATE_USER');

-- Check configuration
SELECT * FROM Whitelabels;
```

### 5. Log Verification

Check logs during suspension for:
- "Applying whitelabel-specific suspension behavior"
- Proper whitelabel_id and suspension_behavior values
- Correct method calls (deactivateUser vs deactivateUserPremium)
- Fallback warnings if whitelabel not found

## Key Design Decisions

1. **ENUM type** for clear, type-safe values at database level:
   - `DOWNGRADE_TO_FREE`: Sets `is_premium = 0`, user remains active (default)
   - `DEACTIVATE_USER`: Sets `active = 0`, full account deactivation
2. **Parse from subscription.data** to avoid main API changes
3. **Modify existing handler** to keep suspension logic centralized
4. **Default to DOWNGRADE_TO_FREE** for backward compatibility and safety
5. **Graceful fallbacks** at every level (missing data, lookup failures)

## Rollback Strategy

If issues arise:
1. **Immediate:** Revert handler to backup version (forces default behavior)
2. **Code:** Remove whitelabel repository from container.ts
3. **Database:**
   ```sql
   ALTER TABLE Whitelabels DROP COLUMN suspension_behavior;
   ```

## Documentation Update

Add to `CLAUDE.md` under a new section "Whitelabel-Specific Suspension Behavior":
- Explain the two suspension behaviors
- Document how to configure whitelabels
- Include example SQL for testing
- Note the fallback behavior for missing/invalid whitelabels
