---
name: billing-debug
description: Use this skill when debugging production-like billing issues, reproducing user-reported bugs, tracing payment failures, or investigating subscription state. It explains how to query the BillingLogs table, Subscriptions, Transactions, PurchaseRequests, and Users via the `yarn dev:tools` CLI. Use when the user asks to "look up", "investigate", "trace", "debug", or "find logs/transactions/subscriptions/purchase-requests for" a user, request, or time window.
---

# billing-debug

The `yarn dev:tools` CLI has read-only query commands for the billing data store. Use them instead of writing ad-hoc SQL, MySQL shell sessions, or new one-off scripts — they already apply sensitive-data redaction and format output consistently.

**The dev server must be running** (`yarn dev`) — the CLI is a thin client that calls `/api/dev/*` routes on localhost.

## Safety: sensitive-data redaction

All query responses pass through a server-side redactor in [api/routes/dev/routes.ts](api/routes/dev/routes.ts) before leaving the endpoint. Any object key matching the `SENSITIVE_KEY_REGEX` pattern (`password`, `token`, `api_key`, `secret`, `authorization`, `bearer`, `private_key`, `access_token`, `refresh_token`, `jwt`, `cookie`, `session_id`, `client_secret`, `signature`, `hash`, `credential`, `cvv`, `cvc`, `card_number`, `pan`, `account_number`, `routing_number`, `ssn`) is replaced with `"[REDACTED]"`. This applies recursively and inside JSON strings (e.g. the `metadata` column on BillingLogs, `data` on Subscriptions and Transactions).

If you ever see an unredacted secret in output, that is a bug in the redactor — fix the regex in [api/routes/dev/routes.ts](api/routes/dev/routes.ts), not the CLI. Do not add client-side rendering that would bypass it.

## Commands

### `logs [user_id]` — query BillingLogs

```
yarn dev:tools logs                                       # recent 50 across all users
yarn dev:tools logs 42                                    # recent 50 for user 42
yarn dev:tools logs --level error --since 24              # errors in the last 24h
yarn dev:tools logs --component payment-processor
yarn dev:tools logs --context-type cron_job --since 6
yarn dev:tools logs --request-id abc-123
yarn dev:tools logs --search "renewal failed" --since 72
yarn dev:tools logs 42 --level warn --limit 200
```

Filters AND together. `--since` is hours. `--limit` defaults to 50, max 500. Each row prints time, level, component, user_id, request_id, message, and a redacted metadata blob.

### `log <log_id>` — full detail for one log

```
yarn dev:tools log 18472
```

Prints every field including the full `error_stack` and pretty-printed `metadata`. Use this after `logs` surfaces a suspicious entry.

### `logs-request <request_id>` — trace one request

```
yarn dev:tools logs-request 3f9a-...
```

Returns every log line for a single `request_id`, time-ordered. This is the fastest way to reconstruct what happened during one HTTP request, webhook, or cron tick.

### `subs [user_id]` — query Subscriptions

```
yarn dev:tools subs 42
yarn dev:tools subs --status suspended
yarn dev:tools subs --overdue                     # active + renewal_date in the past
yarn dev:tools subs --failures-gte 2 --limit 20
yarn dev:tools subs --product-id 7
```

Joins `Products` so `product_name` is shown. Flags like `cancel_on_renewal` / `downgrade_on_renewal` / `suspension_date` are highlighted.

### `purchase-requests [user_id]` — query PurchaseRequests

Every purchase attempt (new purchase, renewal, upgrade) writes a row here with a granular status. This is the table to check when a user says "I paid but nothing happened" — a row stuck in an in-progress status (`PENDING`, `VALIDATING`, `PROCESSING_PAYMENT`, `CREATING_SUBSCRIPTION`, `FINALIZING`) is a purchase that failed halfway through: Square may have charged the card, or a subscription may have been half-created, before the request died (crash, unhandled exception, deploy interruption). Use `--stuck` to surface exactly those rows.

```
yarn dev:tools purchase-requests                              # recent 50 across all users
yarn dev:tools purchase-requests 42                           # recent 50 for user 42
yarn dev:tools purchase-requests --status FAILED --since 24
yarn dev:tools purchase-requests --stuck                      # in-progress > 5m — likely failed mid-flow
yarn dev:tools purchase-requests --stuck --stuck-minutes 15
yarn dev:tools purchase-requests --type RENEWAL --source CRON --since 168
yarn dev:tools purchase-requests --email @acme.com
```

Filters AND together. `--since` is hours. `--limit` defaults to 50, max 500. Each row prints status, request_type, source, user/email, product, amount charged, retries, timing, result ids (`sub:`/`tx:`), and failure reason if any. Rows flagged `[STUCK]` are non-terminal and older than the `--stuck-minutes` threshold (default 5).

**Statuses**: `PENDING`, `VALIDATING`, `PROCESSING_PAYMENT`, `CREATING_SUBSCRIPTION`, `FINALIZING`, `COMPLETED`, `FAILED`, `RETRY_SCHEDULED`
**Request types**: `NEW_PURCHASE`, `RENEWAL`, `UPGRADE`
**Sources**: `API`, `CRON`, `ADMIN`

### `purchase-request <request_id>` — full detail for one purchase request

```
yarn dev:tools purchase-request 18472
yarn dev:tools purchase-request 550e8400-e29b-41d4-a716-446655440000   # request_uuid also works
```

Prints every field including timing, retries, result ids, failure reason/code, and the full `request_data` JSON (sensitive keys redacted). Use this after `purchase-requests` surfaces a suspicious entry — especially anything flagged `[STUCK]` or `FAILED`.

### `transactions [user_id]` — query Transactions

```
yarn dev:tools transactions 42
yarn dev:tools transactions --status failed --since 24
yarn dev:tools transactions --type charge --limit 100
yarn dev:tools transactions --type webhook
```

`--type` is one of `charge`, `refund`, `webhook`. `--since` is hours.

### `find-user <email>` — look up a user by email

```
yarn dev:tools find-user david@example.com
yarn dev:tools find-user @acme.com --limit 50
```

Uses `LIKE %email%`, so a substring works. Returns `user_id`, role, `is_premium`, `active`, `whitelabel_id`.

## Related existing commands (already in the CLI)

- `state <user_id>` — full dump (user + card + subs + last 25 transactions + last 25 logs)
- `system` — system-wide counts, overdue renewals, recent failures
- `cron-preview` — what the cron would do right now
- `verify` — product/subscription integrity check

For a user-reported issue, `state <user_id>` is usually the first call.

## Typical debugging flow

1. User reports "my payment failed" → `yarn dev:tools find-user <their-email>` to get `user_id`.
2. `yarn dev:tools state <user_id>` for the full snapshot.
3. `yarn dev:tools purchase-requests <user_id> --since 168` to see every purchase attempt and its status. Anything `FAILED`, `[STUCK]`, or without a `sub:`/`tx:` result id is a candidate.
4. `yarn dev:tools transactions <user_id> --status failed --since 168` to see the failed charge on Square.
5. Grab the `request_id` from the matching log in `yarn dev:tools logs <user_id> --level error --since 168`.
6. `yarn dev:tools logs-request <request_id>` to replay the exact request that failed.
7. `yarn dev:tools log <log_id>` on any specific entry for full metadata / stack trace.
8. `yarn dev:tools purchase-request <pr_request_id>` for the full purchase-request record (timing, retries, result ids, request_data).

## Spotting purchases that failed mid-flow

Across all users: `yarn dev:tools purchase-requests --stuck` surfaces every non-terminal PurchaseRequest older than 5 minutes. These are the dangerous ones — a request can be stuck after Square has charged a card but before the subscription/user is finalized, so they need manual reconciliation. Tune with `--stuck-minutes <n>` if you need a stricter or looser window.

## What NOT to do

- Do not write new SQL scripts to query these tables — extend a command in [scripts/dev.ts](scripts/dev.ts) and the matching route in [api/routes/dev/routes.ts](api/routes/dev/routes.ts) instead.
- Do not dump raw metadata to chat without running it through the CLI (the redaction lives there).
- Do not run these in production — the `/dev/*` routes are disabled when `NODE_ENV=production` (see the guard at the top of [api/routes/dev/routes.ts](api/routes/dev/routes.ts)).
