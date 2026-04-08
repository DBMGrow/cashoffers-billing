# Integration: SendGrid

## Purpose
Sends transactional emails for subscription lifecycle events.

## Key Files
- `api/infrastructure/email/sendgrid/sendgrid.service.ts`
- `api/infrastructure/email/templates/` — React Email templates

## Config
```
SENDGRID_API_KEY=...
SEND_EMAILS=true|false
ADMIN_EMAIL=...
DEV_EMAIL=...
SYSTEM_EMAIL=...
SYSTEM_FROM_NAME=...
```

## Notes
- `SEND_EMAILS=false` disables all email sending (useful in tests/local dev)
- `DEV_EMAIL` redirects all emails to one address in non-production
- Templates are React Email components (migrated from MJML)
- Preview: `yarn preview:emails`
- Email failures are logged but do not block subscription operations
