# Runbook: Dev Tools CLI

The dev CLI (`yarn dev:tools`) lets you inspect and simulate system state against a real database.

## Start

```bash
yarn dev:tools
```

## Commands

| Command | Description |
|---------|-------------|
| `system` | Overview: subscriptions, failures, trials, pending renewals |
| `state <user_id>` | Full user state: subscriptions, cards, transactions |
| `scenario <name>` | Create a test scenario (see below) |
| `set-state <sub_id> [fields]` | Patch subscription state |
| `cron-preview` | Dry-run of renewal logic (no writes) |
| `cron-run <user_id>` | Execute renewal for one user |
| `webhook <type> <user_id>` | Fire a webhook event |
| `cleanup <user_id>` | Delete user and all related data |

## Scenarios

| Scenario | Command |
|----------|---------|
| Subscription due for renewal | `scenario renewal-due` |
| Payment retry in progress | `scenario payment-retry` |
| Trial expiring soon | `scenario trial-expiring` |

## Key File
- `scripts/dev.ts` — all CLI logic (422 lines)

## Notes
- Runs against the configured database (local or via SSH tunnel)
- Use `yarn dev:tunnel` to run against staging DB via SSH
- `cleanup` is destructive — use with caution
