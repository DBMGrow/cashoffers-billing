# System

How the system is built — architecture, components, integrations, and data flows.

## Contents

| Doc | Description |
|-----|-------------|
| [Architecture](architecture) | Layers, tech stack, directory map |
| [Components](components/) | Major internal pieces |
| [Integrations](integrations/) | External services |
| [Data Flows](data-flows/) | Key request and event flows |

## Components

| Component | Description |
|-----------|-------------|
| [Subscription Cron](components/subscription-cron) | Automated renewal, retry, and trial expiration |
| [Auth Middleware](components/auth-middleware) | Token validation and permission checking |
| [Event Bus](components/event-bus) | In-memory domain event dispatch |
| [Payment Processor](components/payment-processor) | Square charge/refund orchestration |

## Integrations

| Integration | Description |
|------------|-------------|
| [Square](integrations/square) | Card tokenization, charges, refunds |
| [Main API](integrations/main-api) | User CRUD and data fetch |
| [SendGrid](integrations/sendgrid) | Email delivery |
| [HomeUptick](integrations/homeuptick) | Tier and addon data |

## Data Flows

| Flow | Description |
|------|-------------|
| [Purchase Flow](data-flows/purchase-flow) | New and existing user purchase |
| [Renewal Flow](data-flows/renewal-flow) | Cron-driven subscription renewal |
| [Webhook Flow](data-flows/webhook-flow) | Incoming events from main API |
