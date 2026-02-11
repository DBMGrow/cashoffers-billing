# OpenAPI Schemas & Zod Validation Implementation Plan

## Context

The CashOffers billing service currently has **31 endpoints across 8 route files** without OpenAPI documentation or route-level validation. While Zod validation schemas exist at the use-case layer (`api/use-cases/types/validation.schemas.ts`), routes perform only basic manual validation. This creates several issues:

1. **No API Documentation**: Clients have no specification or interactive docs
2. **Inconsistent Validation**: Manual checks scattered across routes (e.g., `if (!user_id) return error`)
3. **Late Error Detection**: Validation happens in use cases after auth/parsing overhead
4. **Type Safety Gaps**: Route handlers manually parse and cast values without compile-time checks

This plan adds comprehensive OpenAPI documentation with Swagger UI and route-level Zod validation while maintaining the existing use-case validation for defense-in-depth.

## Recommended Approach

### Library: `@hono/zod-openapi`

Use the official Hono OpenAPI library (`@hono/zod-openapi` + `@scalar/hono-api-reference`) for these reasons:

- **Native Hono Integration**: Built by the Hono team, seamless compatibility with v4.11.7
- **Type Safety**: Automatic TypeScript inference from Zod schemas to route handlers
- **Single Source of Truth**: OpenAPI spec generated directly from Zod validation schemas
- **Built-in Validation**: Automatic request/response validation before handlers execute
- **Modern UI**: Scalar provides beautiful interactive docs (superior to Swagger UI)

### Architecture: Defense-in-Depth Validation

**Keep validation at both layers:**

1. **Route Layer** (new): Validates HTTP contract (shape, types, required fields) using route-specific schemas
2. **Use Case Layer** (existing): Validates business rules and complex constraints

**Rationale**: Use cases are domain logic and should never trust inputs, regardless of source. Route validation provides fast-fail for malformed requests with clear API errors before expensive operations.

### Schema Organization

Create separate route-level schemas at `api/routes/schemas/` organized by domain:

```
api/routes/schemas/
├── common.schemas.ts       # Shared (error responses, pagination, ID params)
├── payment.schemas.ts      # Payment endpoints
├── subscription.schemas.ts # Subscription endpoints
├── card.schemas.ts         # Card endpoints
├── product.schemas.ts      # Product endpoints
├── property.schemas.ts     # Property unlock
└── index.ts                # Re-exports
```

**Why separate from use-case schemas:**
- Different naming conventions (API: `user_id`, use cases: `userId`)
- Different field sets (routes don't need `context`, `sendEmailOnCharge`, etc.)
- Allows API evolution independent of business logic
- Routes can accept optional fields with defaults that become required in use cases

## Implementation Steps

### Phase 1: Setup & Infrastructure

**Install dependencies:**
```bash
npm install @hono/zod-openapi @scalar/hono-api-reference
```

**Create schema directory:**
```bash
mkdir -p api/routes/schemas
```

**Files to create:**

1. **`api/routes/schemas/common.schemas.ts`** - Foundation schemas:
   - `SuccessResponseSchema<T>` - Wraps success responses: `{ success: "success", data: T }`
   - `ErrorResponseSchema` - Standard errors: `{ success: "error", error: string, code?: string }`
   - Common validators: `PositiveIntSchema`, `EmailSchema`, `PaginationQuerySchema`
   - Parameter schemas: `UserIdParamSchema`, `SubscriptionIdParamSchema`

2. **Update `api/app.ts`**:
   - Replace `import { Hono }` with `import { OpenAPIHono } from '@hono/zod-openapi'`
   - Replace `new Hono()` with `new OpenAPIHono<{ Variables: HonoVariables }>()`
   - Add OpenAPI JSON endpoint: `app.doc('/openapi.json', { ... })`
   - Add Scalar UI: `app.get('/docs', apiReference({ ... }))`
   - Configure security schemes (ApiTokenAuth in header)

### Phase 2: Migrate Payment Routes (Reference Implementation)

**Priority**: Simplest route (3 endpoints), serves as template for others.

**Create `api/routes/schemas/payment.schemas.ts`:**
- `CreatePaymentRequestSchema` - POST body: `{ user_id, amount, email, memo? }`
- `RefundPaymentRequestSchema` - POST body: `{ user_id, transaction_id, email? }`
- `GetPaymentsQuerySchema` - GET query: `{ page?, limit?, all? }`
- Response schemas: `CreatePaymentResponseSchema`, `RefundPaymentResponseSchema`, `GetPaymentsResponseSchema`
- Route definitions using `createRoute()` with full OpenAPI metadata

**Update `api/routes/payment.ts`:**
- Replace `Hono` with `OpenAPIHono`
- Convert each endpoint from `app.get()` to `app.openapi(createRoute(...), handler)`
- Access validated data via `c.req.valid('json')`, `c.req.valid('param')`, `c.req.valid('query')`
- Remove manual validation checks (Zod handles it)
- Keep auth middleware: `authMiddleware('payments_create')` works with OpenAPI routes

**Pattern example:**
```typescript
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { CreatePaymentRoute } from './schemas/payment.schemas'

const app = new OpenAPIHono<{ Variables: HonoVariables }>()

app.openapi(
  createRoute(CreatePaymentRoute),
  authMiddleware('payments_create'),
  async (c) => {
    const body = c.req.valid('json')  // Already validated!
    // Transform snake_case → camelCase for use case
    return executeUseCase(c, () =>
      container.useCases.createPayment.execute({
        userId: body.user_id,
        amount: body.amount,
        email: body.email,
        memo: body.memo || 'Payment',
      })
    )
  }
)
```

### Phase 3: Migrate Subscription Routes

**Complexity**: Highest (10 endpoints) with custom authorization patterns.

**Create `api/routes/schemas/subscription.schemas.ts`:**
- Request/response schemas for all 10 endpoints
- Enums: `SubscriptionStatusSchema`, `DurationSchema`
- Handle special cases: `/cancel/:subscription_id`, `/downgrade/:subscription_id`

**Update `api/routes/subscription.ts`:**
- Migrate each endpoint (GET, POST, PUT, DELETE, pause, resume, cancel, uncancel, downgrade, undowngrade)
- Preserve custom auth via `checkSubscriptionAuthorization` helper
- Note: Some endpoints use `authMiddleware(null)` with custom checks inside handler

### Phase 4: Migrate Remaining Routes

**In order:**
1. **Card routes** (3 endpoints) - `api/routes/card.ts`
2. **Product routes** (4 endpoints) - `api/routes/product.ts`
3. **Purchase route** (1 endpoint, complex body) - `api/routes/purchase.ts`
4. **Property route** (1 endpoint) - `api/routes/property.ts`
5. **Email route** (1 endpoint, no auth) - `api/routes/emails.ts`
6. **Cron route** (1 endpoint, secret auth) - `api/routes/cron.ts`

Each follows same pattern: create schemas → update route file → test.

### Phase 5: Documentation & Polish

**Enhance OpenAPI metadata:**
- Add detailed descriptions to all routes
- Add request/response examples
- Organize endpoints with tags: `['Payments']`, `['Subscriptions']`, `['Cards']`, etc.
- Document error codes (e.g., `0000B: Unauthorized`)

**Testing:**
- Unit tests for schema validation (Vitest)
- Integration tests for routes
- Manual testing via Swagger UI at `/docs`
- Verify backward compatibility

**Update documentation:**
- Update `CLAUDE.md` with new validation patterns
- Document OpenAPI endpoints: `/openapi.json`, `/docs`
- Add examples of creating new routes

## Critical Files

### Files to Create

1. **`api/routes/schemas/common.schemas.ts`** - Foundation for all route schemas
2. **`api/routes/schemas/payment.schemas.ts`** - Payment route schemas (first implementation)
3. **`api/routes/schemas/subscription.schemas.ts`** - Most complex route schemas
4. **`api/routes/schemas/card.schemas.ts`** - Card route schemas
5. **`api/routes/schemas/product.schemas.ts`** - Product route schemas
6. **`api/routes/schemas/property.schemas.ts`** - Property route schemas
7. **`api/routes/schemas/purchase.schemas.ts`** - Purchase route schemas (complex)
8. **`api/routes/schemas/index.ts`** - Re-exports all schemas

### Files to Modify

1. **`api/app.ts`** - Main app setup, replace Hono with OpenAPIHono, add docs endpoints
2. **`api/routes/payment.ts`** - First route migration (reference implementation)
3. **`api/routes/subscription.ts`** - Most complex migration (10 endpoints)
4. **`api/routes/card.ts`** - Card endpoints
5. **`api/routes/product.ts`** - Product endpoints
6. **`api/routes/purchase.ts`** - Purchase endpoint
7. **`api/routes/property.ts`** - Property unlock
8. **`api/routes/emails.ts`** - Email preview
9. **`api/routes/cron.ts`** - Cron job trigger

### Files to Reference (No Changes)

1. **`api/use-cases/types/validation.schemas.ts`** - Keep existing use-case validation
2. **`api/middleware/authMiddleware.ts`** - Works unchanged with OpenAPIHono
3. **`api/middleware/errorHandler.ts`** - Handles OpenAPI validation errors automatically
4. **`api/routes/helpers/use-case-handler.ts`** - `executeUseCase` works unchanged

## Key Design Patterns

### Request Schema (snake_case for HTTP API)
```typescript
export const CreatePaymentRequestSchema = z.object({
  user_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().min(1),
  email: z.string().email(),
  memo: z.string().optional(),
})
```

### Response Schema (using wrapper)
```typescript
export const CreatePaymentResponseSchema = SuccessResponseSchema(
  z.object({
    transactionId: z.string(),
    squarePaymentId: z.string(),
    amount: z.number(),
    status: z.string(),
  })
)
```

### Route Definition with OpenAPI Metadata
```typescript
export const CreatePaymentRoute = {
  method: 'post' as const,
  path: '/payment',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePaymentRequestSchema,
          example: { user_id: 123, amount: 25000, email: 'user@example.com' },
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CreatePaymentResponseSchema } },
      description: 'Payment created successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error or payment failed',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized - invalid or missing API token',
    },
  },
  security: [{ ApiTokenAuth: [] }],
  tags: ['Payments'],
  summary: 'Create one-time payment',
}
```

### Route Handler with Validation
```typescript
app.openapi(
  createRoute(CreatePaymentRoute),
  authMiddleware('payments_create'),
  async (c) => {
    const validated = c.req.valid('json')  // Type-safe, already validated!

    // Transform to use case input (snake → camel)
    return executeUseCase(c, () =>
      container.useCases.createPayment.execute({
        userId: validated.user_id,
        amount: validated.amount,
        email: validated.email,
        memo: validated.memo || 'Payment',
      })
    )
  }
)
```

## Verification Steps

After implementation, verify:

1. **OpenAPI Spec Generated**: Visit `http://localhost:3000/openapi.json` - should return valid OpenAPI 3.0 spec
2. **Swagger UI Works**: Visit `http://localhost:3000/docs` - should load Scalar UI with all endpoints
3. **Validation Works**: Test malformed requests (missing fields, wrong types) - should return 400 with Zod errors
4. **Auth Works**: Test without token - should return 401
5. **Backward Compatible**: Existing clients should work unchanged
6. **All 31 Endpoints Documented**: Check `/docs` shows all routes organized by tags
7. **Try It Out**: Use Swagger UI to test each endpoint interactively
8. **Type Safety**: Run `npm run build` - no TypeScript errors

## Benefits

- **Interactive Documentation**: `/docs` provides beautiful UI for exploring API
- **Auto-Validation**: Malformed requests fail fast with clear error messages
- **Type Safety**: TypeScript knows exact shape of validated inputs
- **Client Generation**: OpenAPI spec enables auto-generating SDK clients
- **Testing**: Swagger UI makes manual testing easier
- **Onboarding**: New developers can explore API without reading code
- **Defense-in-Depth**: Route + use-case validation catches errors at multiple layers
