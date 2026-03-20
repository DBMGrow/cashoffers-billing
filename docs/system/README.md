# System

How the system is built — architecture, components, integrations, and data flows.

## Contents

| Doc | Description |
|-----|-------------|
| [Architecture](architecture.md) | Layers, tech stack, directory map |
| [Components](components/) | Major internal pieces |
| [Integrations](integrations/) | External services |
| [Data Flows](data-flows/) | Key request and event flows |

## Components

| Component | Description |
|-----------|-------------|
| [Subscription Cron](components/subscription-cron.md) | Automated renewal, retry, and trial expiration |
| [Auth Middleware](components/auth-middleware.md) | Token validation and permission checking |
| [Event Bus](components/event-bus.md) | In-memory domain event dispatch |
| [Payment Processor](components/payment-processor.md) | Square charge/refund orchestration |

## Integrations

| Integration | Description |
|------------|-------------|
| [Square](integrations/square.md) | Card tokenization, charges, refunds |
| [Main API](integrations/main-api.md) | User CRUD and data fetch |
| [SendGrid](integrations/sendgrid.md) | Email delivery |
| [HomeUptick](integrations/homeuptick.md) | Tier and addon data |

## Data Flows

| Flow | Description |
|------|-------------|
| [Purchase Flow](data-flows/purchase-flow.md) | New and existing user purchase |
| [Renewal Flow](data-flows/renewal-flow.md) | Cron-driven subscription renewal |
| [Webhook Flow](data-flows/webhook-flow.md) | Incoming events from main API |
