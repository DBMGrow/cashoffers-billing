# Purchase Process Analysis: Why It's Complex and How to Fix It

## Executive Summary

The legacy purchase process suffers from deeply nested function chains, unclear boundaries, scattered error handling, and mixed concerns. The new use case architecture addresses these issues by centralizing business logic, standardizing patterns, and creating clear boundaries between layers.

---

## Current State: Problems with Legacy Purchase Process

### 1. **Deep Function Nesting & Hidden Dependencies**

The purchase flow creates a complex call chain that's hard to trace:

```
Route Handler
  → handlePurchase()
    → createNewSubscription() OR updateExistingSubscription()
      → handlePaymentOfSubscription()
        → getHomeUptickSubscription()
        → createPayment()
          → handlePaymentResults()
            → paymentCompleted()
              → sendEmail()
```

**Problems:**
- **6+ levels deep** - debugging requires jumping through multiple files
- **Hidden side effects** - functions mutate state and call external APIs without clear contracts
- **Unclear ownership** - who's responsible for what operation?
- **Context passing** - `req` and `user` objects passed through multiple layers

**Example from [handlePurchase.js](../src/utils/handlePurchase.js:6-21):**
```javascript
export default async function handlePurchase(product_id, user, userIsSubscribed, userWithEmailExists, waiveSignupFee) {
  const product = await Product.findOne({ where: { product_id } })
  // Direct database access mixed with business logic
  switch (product.product_type) {
    case "subscription":
      if (userIsSubscribed) return await updateExistingSubscription(product, user)
      return await createNewSubscription(product, user, userWithEmailExists, waiveSignupFee)
  }
}
```

### 2. **Unclear Error Handling Patterns**

Different error handling approaches across the codebase:

- **Returning error objects:** `return { success: "error", error: error.message }`
- **Throwing CodedError:** `throw new CodedError("product not found", "HPUR01")`
- **Throwing Error:** `throw new Error("amount is required")`
- **Silent failures:** Some functions catch and swallow errors

**Example from [createPayment.js](../src/utils/createPayment.js:7-48):**
```javascript
export default async function createPayment(req, options) {
  try {
    // ... validation
    const response = await client.paymentsApi.createPayment({...})
    return handlePaymentResults(req, response, email, options)
  } catch (error) {
    // Email sent here, but error still returned
    await sendEmail({ to: process.env.ADMIN_EMAIL, ... })
    return { success: "error", error: error.message }
  }
}
```

**Why This Is Hard to Debug:**
- Unclear when exceptions bubble up vs. get caught
- Different callers expect different error formats
- No consistent error code system
- Side effects (emails) happen in error handlers

### 3. **Mixed Concerns & Responsibilities**

Functions do too many things at once:

**[createNewSubscription.js](../src/utils/createNewSubscription.js:8-118)** performs:
1. ✅ Business logic (subscription creation)
2. ❌ External API calls (user activation, team creation)
3. ❌ Database operations (direct Sequelize queries)
4. ❌ Payment processing
5. ❌ Email notifications
6. ❌ Transaction logging

**[handlePaymentOfSubscription.js](../src/utils/handlePaymentOfSubscription.js:8-135)** performs:
1. ✅ Payment orchestration
2. ❌ Addon detection (HomeUptick)
3. ❌ Payment execution
4. ❌ Renewal date calculation
5. ❌ Status updates
6. ❌ Email sending
7. ❌ Transaction logging
8. ❌ Retry scheduling

**Single Responsibility Principle Violated:** Each function should have ONE reason to change.

### 4. **State Management Issues**

**Implicit State Mutations:**
```javascript
// From createNewSubscription.js:100-104
await handlePaymentOfSubscription(subscription, user.email, {
  sendCreationEmail: true,
  signupFee,
})
// handlePaymentOfSubscription mutates the subscription's renewal_date
// but caller doesn't know this happened!
```

**Race Conditions:**
- Multiple async operations without proper coordination
- No transaction boundaries
- External API calls can fail leaving partial state

**Example from [updateExistingSubscription.js](../src/utils/updateExistingSubscription.js:22-73):**
```javascript
// Create team
const team = await fetch(process.env.API_URL + "/teams", {...})
// ❌ If this fails, what happens?

// Update user
const userUpdate = await fetch(process.env.API_URL + "/users/" + user.user_id, {...})
// ❌ If this fails, team is already created!

// Update subscription
const updatedSubscription = await subscription.update({...})
// ❌ If this fails, user and team are in wrong state!
```

### 5. **Testing Nightmares**

**Why Current Code Is Hard to Test:**

1. **Direct Database Access:**
   ```javascript
   const product = await Product.findOne({ where: { product_id } })
   ```
   - Can't mock without complex Sequelize mocking
   - Requires database in test environment

2. **Direct External API Calls:**
   ```javascript
   const team = await fetch(process.env.API_URL + "/teams", {...})
   ```
   - Can't test without running external services
   - Flaky tests due to network issues

3. **Hidden Dependencies:**
   ```javascript
   import sendEmail from "./sendEmail"
   ```
   - Implicit dependency injection
   - Hard to mock in tests

4. **Context Coupling:**
   ```javascript
   function chargeCardSingle(req, options)
   ```
   - Requires full Express request object
   - Can't test business logic without HTTP layer

### 6. **Debugging Challenges**

**When a purchase fails, developers face:**

1. **Log Scatter:**
   - Logs across 6+ files
   - No request ID to correlate logs
   - Inconsistent log formats

2. **State Uncertainty:**
   - Which operations succeeded?
   - Was the card charged?
   - Was the user created?
   - Was the email sent?

3. **Rollback Complexity:**
   - No atomic operations
   - Manual rollback required
   - Partial failures leave inconsistent state

4. **Error Context Loss:**
   ```javascript
   catch (error) {
     return { success: "error", error: error.message }
   }
   ```
   - Stack trace lost
   - Original error context gone
   - Can't tell where failure originated

### 7. **Code Reuse Problems**

**Similar Logic Duplicated:**

Compare [createPayment.js:87-138](../src/utils/createPayment.js:87-138) and [chargeCardSingle.js:87-133](../src/utils/chargeCardSingle.js:87-133):

Both implement `paymentCompleted()` with:
- Same validation logic
- Same email sending logic
- Same transaction logging
- **Slight differences that cause bugs**

**Why Duplication Persists:**
- Functions tightly coupled to their contexts
- Can't extract to shared utility without breaking things
- Fear of refactoring due to unclear boundaries

### 8. **Request/Response Coupling**

**Functions Depend on Express Request Objects:**

```javascript
export default async function createPayment(req, options) {
  let { amount, user_id } = req?.body
  let { email } = req?.user
  // ...
}
```

**Problems:**
- Can't call from cron jobs
- Can't call from message queues
- Can't call from other services
- Business logic tied to HTTP transport

---

## Superior Approach: Use Case Architecture

The new architecture addresses ALL these problems through clean architecture principles.

### Architecture Layers

```
┌─────────────────────────────────────────────────┐
│            Routes (Hono Handlers)               │
│   - HTTP concerns only                          │
│   - Request parsing, response formatting        │
│   - Thin orchestration layer                    │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Use Cases                          │
│   - Pure business logic                         │
│   - Single responsibility                       │
│   - Dependency injection                        │
│   - Testable without mocks                      │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│         Infrastructure Services                 │
│   - Repositories (database)                     │
│   - Payment Provider (Square)                   │
│   - Email Service                               │
│   - User API Client                             │
│   - Logger                                      │
└─────────────────────────────────────────────────┘
```

### Key Improvements

#### 1. **Single Responsibility Use Cases**

Each use case does ONE thing well:

**[PurchaseSubscriptionUseCase](../src/use-cases/subscription/purchase-subscription.use-case.ts:38-361)**
- ✅ Clear inputs and outputs
- ✅ Dependency injection
- ✅ Single business operation
- ✅ Comprehensive error handling
- ✅ Structured logging

```typescript
export class PurchaseSubscriptionUseCase implements IPurchaseSubscriptionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: PurchaseSubscriptionInput): Promise<UseCaseResult<PurchaseSubscriptionOutput>> {
    // All dependencies injected
    // Clear input/output contracts
    // No hidden side effects
  }
}
```

#### 2. **Consistent Error Handling**

**Standardized Result Pattern:**

```typescript
type UseCaseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string }
```

**Benefits:**
- ✅ No thrown exceptions in business logic
- ✅ Explicit error handling
- ✅ Error codes for client handling
- ✅ Type-safe error branches

#### 3. **Dependency Injection**

**No More Hidden Dependencies:**

```typescript
interface Dependencies {
  logger: ILogger
  paymentProvider: IPaymentProvider
  emailService: IEmailService
  userApiClient: IUserApiClient
  productRepository: IProductRepository
  subscriptionRepository: ISubscriptionRepository
  userCardRepository: IUserCardRepository
  transactionRepository: ITransactionRepository
}
```

**Benefits:**
- ✅ Easy to test (inject mocks)
- ✅ Clear dependencies visible in type
- ✅ Swap implementations without changing business logic
- ✅ No global state or singletons

#### 4. **Type Safety**

**Input/Output Contracts:**

```typescript
export interface PurchaseSubscriptionInput {
  productId: number | string
  email: string
  cardToken?: string
  // ... other fields with clear types
}

export interface PurchaseSubscriptionOutput {
  subscriptionId: number
  userId: number
  cardId: string
  productId: number | string
  amount: number
  proratedCharge?: number
  userCreated: boolean
}
```

**Benefits:**
- ✅ Compile-time validation
- ✅ IDE autocomplete
- ✅ Self-documenting code
- ✅ Refactoring safety

#### 5. **Clear Separation of Concerns**

**Route Handler** ([purchase.ts](../src/routes/hono/purchase.ts:10-81)):
```typescript
app.post("/", authMiddleware("payments_create", { allowSelf: true }), async (c) => {
  const body = await c.req.json()
  const container = getContainer()

  // Execute business logic
  const result = await executeUseCase(c, async () => {
    return container.useCases.purchaseSubscription.execute({
      productId: body.product_id,
      email: body.email,
      // ... map HTTP to business inputs
    })
  })

  return result
})
```

**What Route Does:**
- ✅ Parse HTTP request
- ✅ Call use case
- ✅ Format HTTP response
- ❌ NO business logic
- ❌ NO database calls
- ❌ NO external API calls

---

## Comparison: Legacy vs. Use Case

### Purchase Flow Complexity

**Legacy Approach:**
```
Route (unknown file)
  ├─ handlePurchase (utils/handlePurchase.js)
  │   └─ createNewSubscription (utils/createNewSubscription.js)
  │       ├─ fetch("/users/{id}") (external API)
  │       ├─ fetch("/teams") (external API)
  │       ├─ Subscription.create (database file)
  │       └─ handlePaymentOfSubscription (utils/handlePaymentOfSubscription.js)
  │           ├─ getHomeUptickSubscription (utils/getHomeUptickSubscription.js)
  │           ├─ createPayment (utils/createPayment.js)
  │           │   ├─ UserCard.findOne (database file)
  │           │   ├─ client.paymentsApi.createPayment (Square API)
  │           │   └─ sendEmail (utils/sendEmail.js)
  │           └─ Transaction.create (database file)

Total Files: 10+
Function Depth: 6+ levels
External Calls: Scattered across files
```

**Use Case Approach:**
```
Route (routes/hono/purchase.ts)
  ├─ authMiddleware (clear middleware)
  └─ PurchaseSubscriptionUseCase.execute
      ├─ Input validation (Zod schema)
      ├─ productRepository.findById
      ├─ userApiClient.getUserByEmail
      ├─ paymentProvider.createPayment
      ├─ subscriptionRepository.create
      └─ emailService.sendEmail

Total Files: 3 (route, use case, container)
Function Depth: 2 levels
External Calls: Through interfaces
```

### Debugging Experience

**Legacy - When Purchase Fails:**

1. ❌ Check route handler (can't find it easily)
2. ❌ Check handlePurchase.js
3. ❌ Check createNewSubscription.js
4. ❌ Check handlePaymentOfSubscription.js
5. ❌ Parse console.log statements
6. ❌ Determine which operation failed
7. ❌ Check for partial state mutations

**Use Case - When Purchase Fails:**

1. ✅ Check structured logs with request ID
2. ✅ See exact failure point in use case
3. ✅ Error code tells you what failed
4. ✅ Input/output logged automatically
5. ✅ Performance metrics included
6. ✅ Stack trace preserved

---

## Recommendations

### Immediate Actions:

1. **Complete Migration:** Finish remaining high-priority routes
2. **Write Tests:** Achieve 80%+ coverage on use cases
3. **Remove Legacy Code:** Delete old utility functions after migration
4. **Documentation:** Document use case patterns for team

### Long-Term Improvements:

1. **Transaction Management:** Add database transactions for atomic operations
2. **Event Sourcing:** Log domain events for audit trail
3. **Saga Pattern:** Handle distributed transactions (user API + billing)
4. **Circuit Breaker:** Add resilience for external API calls
5. **Observability:** Add distributed tracing

### Standards Going Forward:

1. ✅ **All business logic in use cases**
2. ✅ **All infrastructure behind interfaces**
3. ✅ **All inputs validated with Zod**
4. ✅ **All errors use Result pattern**
5. ✅ **All tests use dependency injection**
6. ✅ **All logs use structured logging**

---

## Conclusion

The legacy purchase process is complex because it:
- Deeply nests function calls
- Mixes concerns across layers
- Lacks clear boundaries
- Has inconsistent error handling
- Is tightly coupled to frameworks
- Is hard to test and debug

The use case architecture solves these by:
- Flattening the hierarchy
- Separating concerns clearly
- Establishing layer boundaries
- Standardizing error handling
- Decoupling from frameworks
- Enabling easy testing and debugging

**The migration is a significant quality improvement that will pay dividends in maintainability, reliability, and developer productivity.**
