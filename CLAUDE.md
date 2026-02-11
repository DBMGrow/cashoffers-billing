# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a billing and subscription management service for CashOffers, built with Express.js and MySQL. It handles payment processing through Square, subscription lifecycle management, and integrates with a separate main API for user data.

## Development Commands

### Running the Application

```bash
npm run dev          # Start with hot-reload using tsx --watch
npm start            # Start without hot-reload
```

### Building and Testing

```bash
npm run build        # Type-check TypeScript (no build artifacts, noEmit: true)
npm test             # Run test suite with Vitest
```

### Database

```bash
npm run codegen      # Generate Kysely types from database schema to src/lib/db.d.ts
```

### Email Templates

```bash
npm run preview:emails   # Generate HTML previews of all MJML email templates
```

After generating previews, open `email-previews/index.html` in your browser to view all templates with desktop/mobile toggle.

## Architecture

### Core Payment Flow

The service orchestrates complex payment workflows involving user creation, card management, and subscription handling:

1. **New User Purchase** (`src/routes/purchase.js`):
   - Validates product and user existence
   - Creates card via Square API if needed
   - Creates new user in main API if they don't exist
   - Handles prorated charges for subscription upgrades
   - Creates subscription via `handlePurchase`

2. **Subscription Management** (`src/routes/subscription.js`):
   - CRUD operations for subscriptions
   - Pause/resume functionality
   - Cancel/downgrade on renewal flags
   - Self-service actions with permission checks

3. **Payment Processing** (`src/utils/createPayment.js`):
   - Square API integration for charges
   - Transaction logging
   - Email notifications
   - Line-item support for multi-part charges

### Subscription Renewal System

Subscription renewals are handled by a cron job (`src/cron/subscriptionsCron.js`) that:

- Finds subscriptions due for renewal
- Fetches user data from main API
- Processes payment via `handlePaymentOfSubscription`
- Handles addon subscriptions (e.g., HomeUptick)
- Updates renewal dates
- Implements retry logic with escalating intervals (1 day, 3 days, then 7 days)
- Skips inactive users

Key behaviors:

- Subscriptions with `cancel_on_renewal: true` are cancelled instead of renewed
- Subscriptions with `downgrade_on_renewal: true` are downgraded
- Failed payments trigger retry scheduling via `updateNextRenewalAttempt`

### Authentication & Authorization

`src/middleware/authMiddleware.js` implements a capability-based permission system:

- Validates requests against main API's user data
- Supports permission strings (e.g., `"payments_create"`)
- `allowSelf: true` option allows users to access their own data
- Token owner vs. resource owner distinction (allows admins to act on behalf of users)

### External Dependencies

- **Square API** (`src/config/square.js`): Payment processing
- **Main API**: User management, fetched via `process.env.API_URL`
- **SendGrid** (`src/utils/sendEmail.js`): Email notifications with HTML templates in `src/templates/`

### Module Aliases

TypeScript and runtime both use `@/` alias for `src/` directory:

- Import with `@/utils/foo` instead of relative paths
- Configured in `tsconfig.json` and `vitest.config.ts`

## Key Patterns

### Error Handling

- Uses `express-async-errors` for automatic async error catching
- `CodedError` class for structured errors with error codes
- `handleErrors` utility centralizes error responses and admin notifications

### Email Notifications

All emails use HTML templates with field substitution:

```javascript
await sendEmail({
  to: email,
  subject: "...",
  template: "subscriptionRenewal.html",
  fields: { amount, date, subscription, lineItems },
})
```

### Transaction Logging

Every payment operation logs to the Transaction table for audit trail, including failures.

### Prorated Charges

When upgrading subscriptions, `checkProrated` calculates the difference between old and new subscription amounts based on time remaining in the billing period.

## Environment Configuration

Required environment variables (see `.env`):

- `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT`: Square API credentials
- `API_URL`, `API_URL_V2`, `API_MASTER_TOKEN`: Main API connection
- `ADMIN_EMAIL`: Error notifications
- `SENDGRID_API_KEY`: Email service
- Database connection: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## Testing

Tests located in `src/tests/unit/` using Vitest. Current coverage focuses on utility functions like `getHomeUptickSubscription`.

To run a single test file:

```bash
npx vitest run src/tests/unit/getHomeUptickSubscription.test.ts
```

## Important Notes

- Amount values are in cents (e.g., 25000 = $250.00)
- User `active` field in main API determines if subscription renewals are processed
- BigInt values are serialized to strings via `config/startup.js` prototype extension
- The service uses both `.js` (JavaScript) and `.ts` (TypeScript) files, with TypeScript configured for type-checking only (`noEmit: true`)
