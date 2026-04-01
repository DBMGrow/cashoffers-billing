# Dev CLI Coverage

All commands in `yarn dev:tools` (`scripts/dev.ts`).

## Commands

| Command | Purpose | Works? |
|---------|---------|--------|
| `system` | Overview of subscriptions, failures, trials | yes |
| `state <user_id>` | Full user state (subs, cards, transactions, payment_failure_count) | yes |
| `scenario <name> [--product <type>] [--email <email>]` | Create named test scenario with optional product type | yes |
| `set-state <sub_id> [fields]` | Patch subscription fields (including payment_failure_count) | yes |
| `cron-preview` | Dry-run renewal logic | yes |
| `cron-run <user_id>` | Execute renewal for one user | yes |
| `webhook <type> <user_id>` | Fire webhook event | yes |
| `cleanup <user_id>` | Delete user and all data | yes |
| `set-password <user_id> <password>` | Set user password for testing manage flows | yes |
| `break-card <user_id>` | Replace card with invalid one (forces payment failures) | yes |
| `fix-card <user_id>` | Restore card with valid sandbox card | yes |

## Scenarios

| Scenario | payment_failure_count | Card | Notes |
|----------|----------------------|------|-------|
| `renewal-due` | 0 | valid | Active sub overdue — cron will charge |
| `payment-failure` | 0 | broken | Overdue with invalid card — cron will fail |
| `payment-retry-1` | 1 | valid | 1 prior failure, retry overdue — break-card then cron-run |
| `payment-retry-2` | 2 | valid | 2 prior failures — break-card then cron-run |
| `payment-retry-3` | 3 | valid | 3 prior failures — next failure auto-suspends |
| `trial-expiring` | 0 | valid | Trial expiring in 9 days — cron sends warning |
| `trial-expired` | 0 | valid | Trial past expiry — cron converts (P-TRIAL) or cancels |
| `cancel-on-renewal` | 0 | valid | cancel_on_renewal=true — cron cancels, not charges |
| `downgrade-on-renewal` | 0 | valid | whitelabel=2, cancel → DOWNGRADE_TO_FREE behavior |
| `paused` | 0 | valid | CO deactivated — not picked up by cron |
| `suspended` | 4 | broken | Max retries exhausted — fix-card triggers immediate payment |

## --product Flag (Product Type Variants)

All scenarios support `--product p-co|p-hu|p-trial` to create different subscription types:

| Product | product_category | managed | role | is_premium | Use for testing |
|---------|-----------------|---------|------|-----------|----------------|
| `p-co` (default) | `premium_cashoffers` | true | AGENT | 1 | CO Premium purchase, combined CO+HU renewals |
| `p-hu` | `external_cashoffers` | false | AGENT | 0 | External CO — billing only manages HU overages |
| `p-trial` | `homeuptick_only` | true | SHELL | 0 | HU Only — SHELL CO access + HU base fee |

Examples:
```bash
yarn dev:tools scenario renewal-due --product p-hu
yarn dev:tools scenario trial-expiring --product p-trial
yarn dev:tools scenario trial-expired --product p-trial
yarn dev:tools scenario suspended --product p-co
```

## Scenario Matrix Coverage

| Matrix Scenario | CLI Support |
|----------------|-------------|
| P1: P-CO purchase | `renewal-due` (active sub) |
| P2: P-HU purchase | `renewal-due --product p-hu` |
| P3: P-TRIAL enrollment | `trial-expiring --product p-trial` |
| R1: P-CO renewal | `renewal-due` + `cron-run` |
| R2: P-HU renewal | `renewal-due --product p-hu` + `cron-run` |
| R3: P-TRIAL conversion | `trial-expired --product p-trial` + `cron-run` |
| F1: User-fault failure | `payment-failure` + `cron-run` |
| F3: Suspend P-CO | `payment-retry-3` + `break-card` + `cron-run` |
| F7: Card update on suspended | `suspended` + `fix-card` |
| PZ1-PZ3: Pause | `renewal-due` + `webhook user.deactivated` |
| PZ4: Resume | `webhook user.activated` |
| W1-W6: Webhooks | `webhook user.deactivated/user.activated/user.created` |
| X1-X3: Cancel on renewal | `cancel-on-renewal` + `cron-run` |
| D1: Downgrade | `downgrade-on-renewal` + `cron-run` |

## Gaps

- No direct CLI for P-TRIAL enrollment flow (card creation during trial start — only post-creation state)
- No CLI for HU auto-trial pause/resume (requires HU API mock)
- No CLI for system-fault failure simulation (HU API down, Square outage)
- No `trigger-card-update` command (card update → immediate payment for suspended subs — pending TODO-001)
