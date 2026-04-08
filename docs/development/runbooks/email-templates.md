# Runbook: Email Templates

## Preview All Templates

```bash
yarn preview:emails
# Open email-previews/index.html in browser
```

## Template Location
`api/infrastructure/email/templates/`

Templates use React Email components.

## Adding a Template

1. Create a new `.tsx` file in `api/infrastructure/email/templates/`
2. Use React Email components (`@react-email/components`)
3. Preview: `yarn preview:emails`
4. Use in code:

```typescript
import { sendEmail } from "@api/infrastructure/email/send-email"

await sendEmail({
  to: user.email,
  subject: "Your subscription renewed",
  template: "subscriptionRenewal",
  fields: { amount: "$25.00", date: "March 20" }
})
```

## Disabling Emails Locally
Set `SEND_EMAILS=false` in `.env` to disable all sending.

Use `DEV_EMAIL` to redirect emails to yourself instead of real users.
