# CashOffers Billing

Billing and subscription management service for CashOffers. Handles payment processing (Square), subscription lifecycle, and user configuration.

## Docs

See [docs/README.md](docs/README.md) for architecture, business logic, development runbooks, and quality tracking.

## Quick Start

```bash
yarn install
yarn dev          # Start dev server
yarn test         # Run tests
yarn dev:tools    # Dev CLI
```

## Tech

Backend: Hono + TypeScript + MySQL (Kysely) + Square + SendGrid
Frontend: Next.js 16 + React 19 + TailwindCSS
