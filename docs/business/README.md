# Business

Describes what the system does (capabilities), constraints it enforces (rules), and why things are built this way (decisions).

## Capabilities

| Capability | Description |
|-----------|-------------|
| [Subscription Lifecycle](capabilities/subscription-lifecycle) | Create, renew, pause, resume, cancel, downgrade subscriptions |
| [Payment Processing](capabilities/payment-processing) | Charge cards, retry on failure, refund payments |
| [Free Trials](capabilities/free-trials) | Start trials, expire them, convert to paid |
| [User Configuration](capabilities/user-configuration) | Apply roles, premium status, and whitelabel from product config |
| [HomeUptick Integration](capabilities/homeuptick-integration) | Addon subscriptions linked to HomeUptick tiers |
| [Whitelabel Support](capabilities/whitelabel-support) | Brand-specific checkout and user assignment |
| [Email Notifications](capabilities/email-notifications) | Transactional emails for lifecycle events |
| [Webhook Handling](capabilities/webhook-handling) | React to user activation/deactivation from main API |

## Rules

| Rule | Description |
|------|-------------|
| [Subscription Rules](rules/subscription-rules) | Status transitions, what can happen in each state |
| [Payment Retry Rules](rules/payment-retry-rules) | Retry intervals, max attempts, suspension trigger |
| [Role Mapping Rules](rules/role-mapping-rules) | How roles change during plan transitions |
| [Authorization Rules](rules/authorization-rules) | Who can do what |

## Decisions

| Decision | Description |
|----------|-------------|
| [Clean Architecture](decisions/clean-architecture) | Why we use use-cases, domain, infrastructure layers |
| [Product-Driven User Config](decisions/product-driven-user-config) | Why products define user roles and premium state |
| [Amounts in Cents](decisions/amounts-in-cents) | Why all monetary values are stored/passed as cents |
| [dotenvx TODO](decisions/dotenvx-todo) | Planned migration to dotenvx for secrets management |
