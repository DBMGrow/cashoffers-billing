# Development

Practical guides for building, testing, and debugging the system.

## Contents

| Section | Description |
|---------|-------------|
| [Scenarios](scenarios/) | Business workflows with test and CLI coverage status |
| [Runbooks](runbooks/) | Setup, testing, dev tools, database |
| [Quality](quality/) | Integration test coverage, discrepancies, todos |

## Quick Start

```bash
# Install
yarn install

# Set up env (copy .env.example or ask a teammate for .env)

# Start dev server
yarn dev

# Run tests
yarn test

# Dev CLI (inspect/simulate system state)
yarn dev:tools
```

See [Local Setup](runbooks/local-setup.md) for full setup instructions.

## Scenarios

| Scenario | Integration Test | Dev CLI |
|----------|-----------------|---------|
| [New User Purchase](scenarios/new-user-purchase.md) | partial | yes |
| [Subscription Renewal](scenarios/subscription-renewal.md) | yes | yes |
| [Trial Expiration](scenarios/trial-expiration.md) | yes | yes |
| [Payment Retry](scenarios/payment-retry.md) | yes | yes |
| [Pause / Resume](scenarios/pause-resume.md) | yes | no |
| [Cancel on Renewal](scenarios/cancel-on-renewal.md) | yes | no |
| [HomeUptick Addon](scenarios/homeuptick-addon.md) | yes | no |
| [Webhook Deactivation](scenarios/webhook-user-deactivation.md) | yes | no |
