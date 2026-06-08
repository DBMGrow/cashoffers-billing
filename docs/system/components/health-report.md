# Component: Daily Health Report

## What It Does
Generates a daily billing-system health report (subscription metrics, payment outcomes, retry/past-due counts) and emails it to a configured set of recipients.

## Key Files
- `api/routes/cron/routes.ts` — HTTP endpoint that builds the recipient list and triggers the report
- `api/domain/services/health-report-recipients.ts` — pure resolver for the recipient list
- `api/domain/services/health-report.service.tsx` — formats and sends the report to each recipient
- `api/domain/services/health-metrics.service.ts` — gathers the metrics
- `api/infrastructure/email/templates/daily-health-report.email.tsx` — email template

## Trigger
- Called by HTTP POST `/api/cron/health-report` with the `CRON_SECRET` in the body
- Expected to be triggered by an external scheduler

## Recipients
The recipient list is resolved by `resolveHealthReportRecipients(config.email)` from three sources, in priority order:

1. `DEV_EMAIL` — required, always the primary recipient
2. `ADMIN_EMAIL` — optional secondary recipient
3. `HEALTH_REPORT_RECIPIENTS` — optional, comma-separated list of additional recipients

The resolver trims blank entries and de-duplicates case-insensitively (preserving first-seen order and casing). If the list resolves to empty, the endpoint throws `No email recipients configured for health reports`.

### Adding recipients
Set the `HEALTH_REPORT_RECIPIENTS` env var (comma-separated) in the relevant env file. These files are encrypted with dotenvx, so set values with:

```
dotenvx set HEALTH_REPORT_RECIPIENTS "alice@x.com,bob@x.com,carol@x.com" -f .env.production
```

No code change is required to add or remove recipients — only the env var.

## Failure Modes
- No recipients configured → endpoint throws before sending
- Report building fails (metrics query / render) → nothing is sent, error logged and rethrown
- Email send fails for a recipient → that recipient is logged and skipped; remaining recipients still receive the report (partial failures logged at `warn` with the failed addresses)
- Email send fails for **every** recipient → job throws `Daily health report failed to send to all recipients`

## Related Components
- [Subscription Cron](subscription-cron)
