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

See [Local Setup](runbooks/local-setup) for full setup instructions.

## Scenarios

| Scenario | Integration Test | Dev CLI |
|----------|-----------------|---------|
| [New User Purchase](scenarios/new-user-purchase) | partial | yes |
| [Subscription Renewal](scenarios/subscription-renewal) | yes | yes |
| [Trial Expiration](scenarios/trial-expiration) | yes | yes |
| [Payment Retry](scenarios/payment-retry) | yes | yes |
| [Pause / Resume](scenarios/pause-resume) | yes | no |
| [Cancel on Renewal](scenarios/cancel-on-renewal) | yes | no |
| [HomeUptick Addon](scenarios/homeuptick-addon) | yes | no |
| [Webhook Deactivation](scenarios/webhook-user-deactivation) | yes | no |
