# Developer Onboarding Guide: CashOffers Billing

Welcome! This guide will walk you through everything you need to know to start developing on the CashOffers Billing system. Whether you're fixing bugs, adding features, or just getting familiar with the codebase, start here.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Development Workflow](#development-workflow)
6. [Key Concepts](#key-concepts)
7. [Common Tasks](#common-tasks)
8. [Debugging and Testing](#debugging-and-testing)
9. [Architecture Deep Dives](#architecture-deep-dives)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

### What Is This Project?

CashOffers Billing is a full-stack billing and subscription management service for the CashOffers platform. It handles:

- **Payment Processing**: Integration with Square API for credit card payments
- **Subscription Lifecycle**: Creating, renewing, upgrading, downgrading, pausing, and canceling subscriptions
- **User Configuration**: Mapping products to user roles, premium status, and white-label assignments
- **Email Notifications**: HTML-based transactional emails for purchases, renewals, and failures
- **Cron Jobs**: Automated subscription renewals with retry logic
- **Whitelabel Support**: Brand customization for different white-label partnerships

### Architecture Style

This project follows **Clean Architecture** (also called Onion/Hexagonal Architecture):

```
┌─────────────────────────────────────────┐
│      Frontend (Next.js)                  │
│  (/app - Pages, Components)              │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Routes (HTTP Entry Points)         │
│  (/api/routes - Hono handlers)           │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Use Cases (Business Logic)         │
│  (/api/use-cases - Orchestration)       │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Domain Layer (Core Concepts)       │
│  (/api/domain - Entities, Services)     │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Infrastructure (Details)            │
│  (/api/infrastructure - External APIs)  │
└─────────────────────────────────────────┘
```

The key principle: **Business logic lives in Use Cases and Domain, not in routes or controllers.**

---

## Tech Stack

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | [Hono](https://hono.dev/) + OpenAPIHono | Lightweight, edge-ready HTTP framework |
| **Database** | MySQL + [Kysely](https://kysely.dev/) | Type-safe SQL query builder |
| **Configuration** | dotenv + TypeScript | Centralized config validation |
| **Payments** | Square SDK | Credit card processing |
| **Email** | SendGrid + React Email | HTML email templates |
| **Async Tasks** | Node.js Cron | Subscription renewal scheduler |
| **Type Safety** | TypeScript | Full type checking |
| **Testing** | Vitest | Fast unit and integration tests |

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 + React 19 | Server/client components |
| **Forms** | React Hook Form | Form state and validation |
| **HTTP** | React Query | Server state management |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **UI Components** | Headless UI, Heroicons | Accessible components |
| **Payment** | React Square Web Payments SDK | Square payment integration |

### Key Libraries

- **express-async-errors**: Automatic async error catching in Hono
- **jsonwebtoken**: JWT token generation/validation
- **zod**: Runtime schema validation
- **bcrypt**: Password hashing
- **module-alias**: `@api/` import paths

---

## Project Structure

### Root Level

```
cashoffers-billing/
├── api/                      # Backend API
├── app/                      # Next.js pages and frontend
├── components/               # Shared React components
├── hooks/                    # Custom React hooks
├── public/                   # Static assets
├── docs/                     # Project documentation
├── CLAUDE.md                 # AI coding assistant instructions
├── DEVELOPER_ONBOARDING.md   # This file
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript configuration
```

### `/api` Directory - Backend

The heart of the system:

```
api/
├── app.ts                    # Main Hono app setup and route mounting
├── config/                   # Environment configuration
│   ├── config.service.ts     # Main config singleton (use this, not process.env)
│   ├── config.interface.ts   # IConfig type definition
│   ├── square.ts             # Square API client factory
│   └── startup.ts            # Initialization scripts
├── lib/                      # Low-level utilities
│   ├── database.ts           # Kysely DB instance
│   ├── db.ts                 # TypeScript types for DB tables
│   └── middleware/           # Global middleware (auth, logging, error handling)
├── domain/                   # Core business concepts (Clean Architecture)
│   ├── entities/             # Data models (Subscription, Payment, etc.)
│   ├── services/             # Domain services (pure business logic)
│   ├── value-objects/        # Small value types (Money, Email, etc.)
│   ├── errors/               # Custom error classes
│   ├── events/               # Domain events
│   └── mappers/              # DTO ↔ Entity mapping
├── use-cases/                # Application workflow orchestration
│   ├── subscription/         # Subscription operations
│   ├── payment/              # Payment operations
│   ├── card/                 # Card operations
│   ├── product/              # Product operations
│   └── base/                 # Abstract base classes
├── infrastructure/           # Integration with external systems
│   ├── external-api/         # API calls to main CashOffers API
│   ├── payment/              # Square payment processor
│   ├── email/                # SendGrid email service
│   ├── logging/              # Structured logging
│   └── monitoring/           # Error tracking
├── routes/                   # HTTP endpoints (Hono handlers)
│   ├── payment/              # POST /api/payment
│   ├── subscription/         # CRUD /api/subscription
│   ├── product/              # CRUD /api/product
│   ├── purchase/             # POST /api/purchase
│   ├── card/                 # Card management endpoints
│   ├── manage/               # Self-service subscription management
│   ├── cron/                 # Scheduled job endpoints
│   └── ...
├── types/                    # Global TypeScript types
├── database/                 # Database migrations
│   └── migrations/           # SQL migration files
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── utils/                    # Helper functions
└── scripts/                  # One-off scripts (migrations, etc.)
```

### `/app` Directory - Frontend (Next.js)

```
app/
├── api/[[...route]]/         # API route handler (delegates to Hono app)
│   └── route.ts              # Lazy-loads Hono app
├── (forms)/                  # Form routes (group layout)
│   ├── layout.tsx            # Form page layout
│   ├── manage/               # Subscription management page
│   └── investor/             # Investor signup page
├── [whitelabel_code]/        # Dynamic whitelabel routes
│   └── subscribe/
│       ├── [product]/        # Product selection + checkout
│       └── page.tsx          # Subscription selection page
└── layout.tsx                # Root layout
```

### `/components` Directory

```
components/
├── auth/                     # Login/auth components
├── forms/                    # Form components
├── common/                   # Reusable UI components
├── subscription/             # Subscription-specific components
└── ...
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18+ (check your system with `node --version`)
- **npm**: v9+ (or similar package manager)
- **MySQL**: 8.0+ for database
- **.env file**: Set up environment variables (see below)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/cashoffers-billing.git
cd cashoffers-billing

# Install dependencies
npm install
```

### 2. Set Up Environment Variables

Copy the template and fill in your secrets:

```bash
cp .env.example .env
```

**Critical variables to set** (see `api/config/config.service.ts` for full list):

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=cashoffers_billing

# Square API (get from Square Dashboard)
SQUARE_ACCESS_TOKEN=your_token
NEXT_PUBLIC_SQUARE_LOCATION_ID=your_location_id
NEXT_PUBLIC_SQUARE_APP_ID=your_app_id
SQUARE_ENVIRONMENT=sandbox  # or 'production'

# Main API Integration
API_URL=http://localhost:8000
API_URL_V2=http://localhost:8000/v2
API_MASTER_TOKEN=your_token
API_KEY=your_key
API_ROUTE_AUTH=/api/auth/verify-token
API_ROUTE_AUTH_V2=/api/v2/auth/verify-token

# Email
SENDGRID_API_KEY=your_key
SENDGRID_FROM_EMAIL=billing@cashoffers.com
DEV_EMAIL=dev@example.com

# JWT
JWT_SECRET=your_very_long_secret_key

# Cron Jobs
CRON_SECRET=your_cron_secret
```

**Important**: Never commit `.env` with real secrets. The `.gitignore` should already exclude it.

### 3. Database Setup

```bash
# Initialize the database (create tables from migrations)
npm run migrate

# Generate TypeScript types from schema
npm run codegen
```

This generates `api/lib/db.d.ts` - a complete TypeScript interface for your database tables.

### 4. Start Development

```bash
# Start the dev server with hot reload
npm run dev
```

Then open your browser to:
- **Frontend**: http://localhost:3000
- **API Health**: http://localhost:3000/api/health
- **API Docs**: http://localhost:3000/api/docs

---

## Development Workflow

### Daily Development Loop

1. **Read the requirements** in the issue/task
2. **Explore the code** - find relevant files using `cmd+p` (VS Code)
3. **Read tests** - understand what's expected by looking at test files
4. **Make changes** - following the architecture guidelines below
5. **Run tests** - verify your changes work
6. **Create a PR** - get code review before merging

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file change)
npm test -- --watch

# Run a specific test file
npm test api/tests/unit/getHomeUptickSubscription.test.ts

# Run tests with UI dashboard
npm test:ui

# Check test coverage
npm test:coverage
```

### Building & Type Checking

```bash
# Type-check TypeScript (no build artifacts)
npm run typecheck

# Type-check only API code
npm run typecheck:api

# Build for production
npm run build
```

### Email Development

```bash
# Generate HTML previews of all email templates
npm run preview:emails
```

Then open `email-previews/index.html` in your browser to preview all emails with desktop/mobile toggle.

### Database Migrations

```bash
# Generate types from current database schema
npm run codegen

# Create a new migration
# 1. Create a new SQL file: api/database/migrations/00X_description.sql
# 2. Write your SQL
# 3. Run the migration manually (or via your migration tool)
```

---

## Key Concepts

### 1. Config Service (Central Configuration)

**Never** use `process.env` directly. Always use the centralized config:

```typescript
// ✅ CORRECT
import { config } from "@api/config/config.service"
const dbHost = config.database.host
const token = config.api.masterToken

// ❌ WRONG
const dbHost = process.env.DB_HOST // ESLint will complain!
```

**Why?** Single source of truth, validation at startup, easier testing, better refactoring.

**Exempted files** (allowed to use `process.env`):
- `api/config/config.service.ts`
- `api/config/startup.ts`
- `api/tests/setup.ts`

### 2. Module Aliases

Avoid long relative paths. Use aliases instead:

```typescript
// ✅ CORRECT
import { db } from "@api/lib/database"
import { config } from "@api/config/config.service"
import { PaymentProcessor } from "@api/infrastructure/payment/payment-processor"

// ❌ WRONG
import { db } from "../../../lib/database"
import { config } from "../../../../config/config.service"
```

Aliases configured in:
- `tsconfig.json` (TypeScript)
- `vitest.config.ts` (Test runner)

### 3. Use Cases - The Heart of Business Logic

Use Cases orchestrate the main workflows:

```typescript
// api/use-cases/subscription/purchase-new-user.use-case.ts
import { PurchaseNewUserUseCase } from "@api/use-cases/subscription/purchase-new-user.use-case"

// Routes call use cases
const purchaseUC = container.get(PurchaseNewUserUseCase)
const result = await purchaseUC.execute({
  userId,
  productId,
  cardNonce,
  whitelabelId
})
```

**Key principle**: Routes should be thin; use cases contain the logic.

### 4. Domain Layer - Core Business Concepts

**Entities** are domain models:

```typescript
// api/domain/entities/subscription.entity.ts
export class Subscription {
  id: bigint
  userId: bigint
  productId: bigint
  amount: Money
  nextRenewalAt: Date
  status: SubscriptionStatus // Enum
  data?: SubscriptionData // Optional JSON
}
```

**Services** contain pure business logic:

```typescript
// api/domain/services/role-mapper.ts
export class RoleMapperService {
  mapRole(oldPlan: PlanType, newPlan: PlanType, baseRole: Role): Role {
    // Mapping logic
  }
}
```

**Value Objects** are immutable small values:

```typescript
// api/domain/value-objects/money.ts
export class Money {
  constructor(private cents: number) {}

  toUSD() { return `$${(this.cents / 100).toFixed(2)}` }
}
```

### 5. Routes - Thin HTTP Handlers

Routes are "thin" - they validate input and delegate to use cases:

```typescript
// api/routes/subscription/routes.ts
export const subscriptionRoutes = new OpenAPIHono()
  .post("/", createSubscriptionHandler)
  .get("/:id", getSubscriptionHandler)

async function createSubscriptionHandler(c: Context) {
  // 1. Parse input
  const body = await c.req.json()

  // 2. Get use case from container
  const createUC = container.get(CreateSubscriptionUseCase)

  // 3. Execute
  const result = await createUC.execute(body)

  // 4. Return response
  return c.json(result)
}
```

### 6. Container (Dependency Injection)

Use Cases and Services depend on each other. A **Container** manages these dependencies:

```typescript
// Somewhere: container setup
const container = new Container()
container.register(PaymentProcessor)
container.register(CreateSubscriptionUseCase, {
  dependencies: [PaymentProcessor, config]
})

// In a route or use case
const createUC = container.get(CreateSubscriptionUseCase)
```

### 7. Amount Values Are in Cents

All monetary amounts throughout the system are in **cents**, not dollars:

```typescript
// $25.00 = 2500 cents
const price = 2500

// When displaying
const displayPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`
displayPrice(2500) // "$25.00"
```

### 8. Subscription Data (Product User Configuration)

Products can store configuration that gets applied to users:

```typescript
// Product data structure
{
  "user_config": {
    "is_premium": 1,          // boolean (0 or 1)
    "role": "AGENT",          // User role
    "white_label_id": 5,      // Whitelabel assignment
    "is_team_plan": false     // For role mapping
  },
  "renewal_cost": 25000,      // cents
  "duration": "monthly"       // Renewal period
}
```

When a user purchases, this config is applied to create/update their account.

### 9. Whitelabel Support

Different partners can have custom branding:

```typescript
// Product can be whitelabel-specific
{
  "product_name": "Premium Monthly",
  "whitelabel_id": 5,    // Only available to this whitelabel
  "data": { ... }
}

// Users see whitelabeled checkout page
// /billing/[whitelabel_code]/subscribe/[product]
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create a use case** if the logic is complex:

```typescript
// api/use-cases/my-feature/my-use-case.ts
export class MyUseCase {
  constructor(private db: DB, private config: IConfig) {}

  async execute(input: Input): Promise<Output> {
    // Business logic here
  }
}
```

2. **Create a route handler**:

```typescript
// api/routes/my-feature/routes.ts
export const myFeatureRoutes = new OpenAPIHono()
  .post("/action", myActionHandler)

async function myActionHandler(c: Context) {
  const useCase = container.get(MyUseCase)
  const result = await useCase.execute(await c.req.json())
  return c.json(result)
}
```

3. **Mount in app.ts**:

```typescript
// api/app.ts
app.route("/my-feature", myFeatureRoutes)
```

### Modifying a Subscription Workflow

1. **Find the relevant use case** (e.g., `purchase-new-user.use-case.ts`)
2. **Understand the current flow** by reading the `execute()` method
3. **Make changes** - keep logic in the use case, not the route
4. **Add tests** - write or update tests in the same directory
5. **Test manually** - use the frontend or API docs to verify

### Fixing a Payment Bug

1. **Check the payment flow** (usually in `api/use-cases/payment/`)
2. **Check Square integration** (`api/infrastructure/payment/`)
3. **Check logs** - look for transaction logs in the database
4. **Write a test** that reproduces the bug
5. **Fix and verify** the test passes

### Adding an Email Template

1. **Create an MJML file**:

```bash
# api/infrastructure/email/templates/myTemplate.mjml
touch api/infrastructure/email/templates/myTemplate.mjml
```

2. **Write the template** using [MJML syntax](https://mjml.io/)

3. **Generate preview**:

```bash
npm run preview:emails
```

4. **Use in code**:

```typescript
import { sendEmail } from "@api/infrastructure/email/send-email"

await sendEmail({
  to: user.email,
  subject: "Subject",
  template: "myTemplate.html",
  fields: { name: "John", amount: "$25.00" }
})
```

### Adding a Database Column

1. **Create migration file**:

```bash
touch api/database/migrations/007_add_my_column.sql
```

2. **Write the SQL**:

```sql
ALTER TABLE subscriptions ADD COLUMN my_column VARCHAR(255) NULL;
```

3. **Run migration** (depends on your setup)

4. **Generate TypeScript types**:

```bash
npm run codegen
```

This updates `api/lib/db.ts` - now TypeScript knows about the new column!

---

## Debugging and Testing

### Writing Tests

Tests go in `api/tests/unit/` or `api/tests/integration/`:

```typescript
// api/tests/unit/my-use-case.test.ts
import { describe, it, expect } from "vitest"
import { MyUseCase } from "@api/use-cases/my-feature/my-use-case"

describe("MyUseCase", () => {
  it("should do something", async () => {
    const useCase = new MyUseCase(mockDb, mockConfig)
    const result = await useCase.execute({ /* input */ })
    expect(result).toEqual({ /* expected */ })
  })
})
```

### Debugging with Logs

The system uses structured logging with `AsyncLocalStorage`:

```typescript
import { logger } from "@api/infrastructure/logging/logger"

logger.info("Processing subscription", { subscriptionId: 123 })
logger.error("Payment failed", { error, subscriptionId: 123 })
```

**Key feature**: All logs from a request get a `requestId` automatically - great for tracing.

### Inspecting the Database

```bash
# Connect to MySQL
mysql -h localhost -u root -p cashoffers_billing

# View subscriptions
SELECT id, user_id, status, next_renewal_at FROM subscriptions LIMIT 10;

# View payments
SELECT id, subscription_id, amount, status FROM payments LIMIT 10;
```

### Common Debugging Steps

**"The API isn't starting"**
- Check `.env` - are all required variables set?
- Check `config.service.ts` - did validation fail?
- Check logs for errors

**"Tests are failing"**
- Run `npm test -- --reporter=verbose` to see details
- Check test setup in `api/tests/setup.ts`
- Mock external dependencies properly

**"My changes aren't showing"**
- Did you save the file?
- Is hot reload working? (check terminal)
- Try stopping and restarting `npm run dev`

---

## Architecture Deep Dives

### Payment Processing Flow

```
Frontend → POST /api/purchase
  ↓
PurchaseNewUserUseCase.execute()
  ├─ Validate product & user
  ├─ Create card via Square
  ├─ Create user in main API
  ├─ Call PaymentProcessor.charge()
  │  ├─ Call Square API
  │  └─ Log transaction
  └─ Create subscription
     └─ Send email notification
  ↓
Frontend ← JSON response
```

**Key files**:
- `api/use-cases/subscription/purchase-new-user.use-case.ts`
- `api/infrastructure/payment/payment-processor.ts`
- `api/routes/purchase/routes.ts`

### Subscription Renewal Flow

Runs via cron job (typically daily):

```
Cron triggers /api/cron/subscriptions
  ↓
SubscriptionsCronJob.execute()
  ├─ Find subscriptions due for renewal
  └─ For each subscription:
     ├─ Fetch user from main API
     ├─ Check if active
     ├─ Call RenewSubscriptionUseCase
     ├─ Process payment
     ├─ Send email
     └─ Update next_renewal_at
  ↓
If payment fails:
  ├─ Schedule retry (1 day, 3 days, 7 days)
  └─ Send failure email
```

**Key files**:
- `api/cron/subscriptions.cron.ts`
- `api/use-cases/subscription/renew-subscription.use-case.ts`
- `api/routes/cron/routes.ts`

### Authentication & Authorization

Every API request (except health check) validates via:

1. **Auth middleware** extracts token from header
2. **Calls main API** to verify token
3. **Attaches user data** to request context
4. **Routes check permissions** (e.g., `allowSelf: true` allows users to modify their own data)

**Key files**:
- `api/lib/middleware/authMiddleware.ts`
- `api/infrastructure/external-api/api-client.ts`

---

## Troubleshooting

### Database Connection Fails

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solution**:
- Is MySQL running? `brew services start mysql` (on Mac)
- Check `DB_HOST`, `DB_USER`, `DB_PASS` in `.env`
- Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### Square API Errors

```
Error: Invalid API Key
```

**Solution**:
- Check `SQUARE_ACCESS_TOKEN` in `.env`
- Verify `SQUARE_ENVIRONMENT` is correct (sandbox vs production)
- Make sure token has appropriate permissions in Square Dashboard

### Email Sending Fails

```
Error: Invalid SendGrid API key
```

**Solution**:
- Check `SENDGRID_API_KEY` in `.env`
- Verify email address in `SENDGRID_FROM_EMAIL` is authorized in SendGrid

### Hot Reload Not Working

```
Changes to files don't reflect when I save
```

**Solution**:
- Stop the dev server (`Ctrl+C`)
- Delete `.next` folder: `rm -rf .next`
- Restart: `npm run dev`

### TypeScript Errors in IDE

```
Cannot find module '@api/utils/foo'
```

**Solution**:
- Run `npm run typecheck` to see real errors
- Verify the file path is correct
- Check `tsconfig.json` for alias configuration
- IDE might need restart: `Ctrl+Shift+P` → "TypeScript: Restart TS Server" (VS Code)

### Test Failures

```
Error: Cannot read property 'database' of undefined
```

**Solution**:
- Are you mocking external dependencies? (config, database, etc.)
- Check `api/tests/setup.ts` for test configuration
- Make sure test imports use `@api/` paths

---

## Next Steps

After reading this guide, you should:

1. ✅ Understand the system architecture
2. ✅ Have a working local development environment
3. ✅ Know where to find code for different features
4. ✅ Understand the main workflows (payment, subscription renewal)
5. ✅ Know how to run tests and debug issues

**Ready to start?**

- Pick an issue to work on
- Read the relevant code
- Write a test (TDD-style)
- Make your changes
- Create a PR for review

**Questions?**

- Check the inline code comments (developers write good docs!)
- Look at similar existing code for patterns
- Ask in the team Slack/Discord
- Check the original CLAUDE.md for more technical details

---

## Quick Reference Cheat Sheet

```bash
# Development
npm run dev                    # Start dev server
npm test                       # Run tests
npm run typecheck              # Check TypeScript
npm run codegen                # Generate DB types
npm run preview:emails         # Preview email templates

# Database
mysql -u root -p              # Connect to database
SHOW DATABASES;               # List databases
USE cashoffers_billing;       # Select database
DESCRIBE subscriptions;       # View table schema

# Common paths
@api/lib/database             # DB instance
@api/config/config.service    # Config (use this!)
@api/infrastructure/          # External integrations
@api/domain/                  # Business logic concepts
@api/use-cases/               # Workflows
@api/routes/                  # HTTP endpoints

# Key files
api/app.ts                    # App setup and route mounting
api/types/hono.ts             # Hono context types
.env                          # Environment variables
CLAUDE.md                     # AI coding guidelines
```

---

## Additional Resources

- **CLAUDE.md** - Project-specific coding guidelines and architecture decisions
- **WHITELABEL_EMAIL_IMPLEMENTATION.md** - Details on whitelabel email features
- **API Documentation** - http://localhost:3000/api/docs (when server running)
- **Email Previews** - http://localhost:3000/email-previews (after `npm run preview:emails`)

Good luck! 🚀
