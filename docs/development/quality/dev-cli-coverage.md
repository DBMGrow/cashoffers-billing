# Dev CLI Coverage

All commands in `yarn dev:tools` (`scripts/dev.ts`).

## Commands

| Command | Purpose | Works? |
|---------|---------|--------|
| `system` | Overview of subscriptions, failures, trials | yes |
| `state <user_id>` | Full user state (subs, cards, transactions) | yes |
| `scenario renewal-due` | Create user + subscription due for renewal | yes |
| `scenario payment-retry` | Create user in retry state | yes |
| `scenario trial-expiring` | Create user with expiring trial | yes |
| `set-state <sub_id> [fields]` | Patch subscription fields | yes |
| `cron-preview` | Dry-run renewal logic | yes |
| `cron-run <user_id>` | Execute renewal for one user | yes |
| `webhook <type> <user_id>` | Fire webhook event | yes |
| `cleanup <user_id>` | Delete user and all data | yes |

## Scenario Coverage

| Scenario | CLI Scenario Available |
|----------|----------------------|
| New user purchase | partial (renewal-due creates user) |
| Subscription renewal | yes (renewal-due + cron-run) |
| Free trial expiration | yes (trial-expiring) |
| Payment retry | yes (payment-retry) |
| Pause/resume | no |
| Cancel on renewal | no |
| HomeUptick addon | no |
| Webhook deactivation | yes (webhook command) |

## Gaps
- No CLI scenario for pause/resume
- No CLI scenario for cancel/uncancel on renewal
- No CLI scenario for HomeUptick addon testing
