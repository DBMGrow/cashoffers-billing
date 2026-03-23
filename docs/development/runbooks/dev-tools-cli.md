# Runbook: Dev Tools CLI

The dev CLI (`yarn dev:tools`) lets you inspect and simulate system state against a real database, and manage environment secrets.

## Start

```bash
yarn dev:tools
```

---

## System & state commands

| Command | Description |
|---|---|
| `system` | Overview: subscriptions, failures, trials, pending renewals |
| `state <user_id>` | Full user state: subscriptions, cards, transactions |
| `scenario <name>` | Create a test scenario (see below) |
| `set-state <sub_id> [fields]` | Patch subscription state directly |
| `cron-preview` | Dry-run of renewal logic (no writes) |
| `cron-run <user_id>` | Execute renewal for one user (real payment logic) |
| `webhook <type> <user_id>` | Fire a CashOffers webhook event |
| `cleanup <user_id>` | Delete user and all related data |

## Scenarios

| Scenario | Command |
|---|---|
| Subscription due for renewal | `scenario renewal-due` |
| Payment retry in progress | `scenario payment-retry` |
| Trial expiring soon | `scenario trial-expiring` |

---

## Environment commands (`env`)

Manage encrypted secrets. All encryption/decryption is handled automatically — never run dotenvx commands directly.

| Command | Description |
|---|---|
| `env setup` | Set up `DOTENV_PRIVATE_KEY_DEVELOPMENT` — retrieve from Keeper, validate, write to shell profile |
| `env setup --env staging` | Set up `DOTENV_PRIVATE_KEY_STAGING` |
| `env setup --env production` | Set up `DOTENV_PRIVATE_KEY_PRODUCTION` — prompts for confirmation first |
| `env edit` | Interactive TUI: add, edit, or delete secrets in `.env.development` |
| `env edit --env staging` | Edit staging secrets (requires `DOTENV_PRIVATE_KEY_STAGING`) |
| `env edit --env production` | Edit production secrets — prompts for confirmation first |
| `env decrypt` | Decrypt `.env.development` to plaintext for bulk editing — **do not commit** |
| `env decrypt --env staging` | Decrypt staging env file |
| `env decrypt --env production` | Decrypt production env file — requires typed confirmation |
| `env encrypt` | Re-encrypt `.env.development` after bulk editing — safe to commit |
| `env encrypt --env staging` | Re-encrypt staging env file |
| `env encrypt --env production` | Re-encrypt production env file |
| `env rotate` | Rotate all environment keys with guided post-rotation checklist |
| `env rotate --env <env>` | Rotate a single environment |

See [environment setup](environment-setup) and [secret management](secret-management) runbooks for full details.

---

## Notes

- Runs against the configured database (local or via SSH tunnel)
- Use `yarn dev:tunnel` to run against staging DB via SSH
- `cleanup` is destructive — use with caution

## Key files

- `scripts/dev.ts` — CLI entrypoint and command definitions
- `scripts/env/setup.ts` — `env setup` flow
- `scripts/env/edit.tsx` — `env edit` Ink TUI
- `scripts/env/decrypt.ts` — `env decrypt` bulk-edit helper
- `scripts/env/encrypt.ts` — `env encrypt` re-encryption after bulk edit
- `scripts/env/rotate.tsx` — `env rotate` Ink guided flow
