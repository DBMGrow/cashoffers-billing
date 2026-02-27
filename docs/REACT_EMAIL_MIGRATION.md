# React Email Migration

## Overview

The email rendering system was migrated from MJML (with `{{variable}}` string substitution) to React Email (typed React components rendered to HTML at runtime).

## Key Changes

### Before (MJML)
```ts
emailService.sendEmail({
  to: email,
  template: 'subscriptionCreated.html',
  fields: { subscription, amount, lineItems: formatLineItemsHtml(items) }
})
```

### After (React Email)
```ts
const html = await render(
  <SubscriptionCreatedEmail subscription={productName} amount={amount} lineItems={items} date={date} />
)
emailService.sendEmail({ to: email, subject, html, templateName: 'subscription-created' })
```

## Architecture

### Component Library

Located at `api/infrastructure/email/templates/components/`.

| File | Purpose |
|---|---|
| `tokens.ts` | Design tokens — colors, font, spacing, radius |
| `email-layout.tsx` | Root `Html + Head + Body + Container` shell |
| `email-header.tsx` | CashOffers wordmark |
| `email-card.tsx` | White content card with rounded border |
| `email-footer.tsx` | Support link + copyright |
| `sandbox-banner.tsx` | Amber warning banner (renders only when `isSandbox=true`) |
| `standard-email.tsx` | Convenience wrapper: Layout + Header + SandboxBanner + Card + Footer |
| `email-heading.tsx` | H1 for card content |
| `email-divider.tsx` | Styled `<Hr>` |
| `email-text.tsx` | Body text with `body / muted / small` variants |
| `summary-table.tsx` | Receipt-style detail table container |
| `summary-row.tsx` | Table rows (`isHeader`, `isTotal`, `bordered` variants) |
| `line-items-table.tsx` | Financial line items (replaces `formatLineItemsHtml()`) |
| `action-button.tsx` | CTA button with `danger / warning / primary` variants |
| `info-box.tsx` | Alert box with `warning / info` variants |
| `metric-row.tsx` | Two-column metric row + `MetricCard` for health report |

### Template Files

Located at `api/infrastructure/email/templates/`. Each is a thin React component importing shared components.

| Template | Event / Trigger |
|---|---|
| `payment-confirmation.email.tsx` | `PaymentProcessed` (one-time/unlock) |
| `payment-error.email.tsx` | (available for future use) |
| `subscription-created.email.tsx` | `SubscriptionCreated` |
| `subscription-renewal.email.tsx` | `SubscriptionRenewed` |
| `subscription-renewal-failed.email.tsx` | `PaymentFailed` |
| `subscription-cancelled.email.tsx` | `SubscriptionCancelled` (admin notification) |
| `subscription-downgraded.email.tsx` | `SubscriptionDowngraded` (admin notification) |
| `subscription-paused.email.tsx` | `SubscriptionPaused` |
| `subscription-suspended.email.tsx` | `SubscriptionDeactivated` |
| `subscription-plan-updated.email.tsx` | (available for future use) |
| `card-updated.email.tsx` | `CardCreated`, `CardUpdated` |
| `refund.email.tsx` | `PaymentRefunded` |
| `account-reactivation.email.tsx` | `/signup/sendreactivation` endpoint |
| `daily-health-report.email.tsx` | `HealthReportService.sendDailyHealthReport()` |

### `IEmailService` Interface

```ts
interface SendEmailRequest {
  to: string
  subject: string
  html: string         // pre-rendered by React Email render()
  templateName: string // for logging and mock filtering
}
```

## Rendering Pattern

All rendering happens at the call site (event handler or service), not inside the email service:

```ts
import { render } from '@react-email/render'
import MyTemplate from '@api/infrastructure/email/templates/my-template.email'

const html = await render(<MyTemplate {...props} />)
await emailService.sendEmail({ to, subject, html, templateName: 'my-template' })
```

For `.ts` files (non-TSX), use `createElement`:
```ts
import { render } from '@react-email/render'
import { createElement } from 'react'
import MyTemplate from '@api/infrastructure/email/templates/my-template.email'

const html = await render(createElement(MyTemplate, props))
```

## Sandbox Emails

Pass `isSandbox={true}` to any template component to show the amber sandbox banner. The `EmailNotificationHandler` derives this from `environment === 'sandbox'` in the event payload.

## Previewing Templates

```bash
npm run preview:emails
# starts React Email dev server at http://localhost:3000
# hot-reload for template changes
```

## Testing

Tests live at `api/infrastructure/email/templates/email-templates.test.ts`. Each template is tested by:
1. Calling `render()` with sample props
2. Asserting the output HTML contains expected values

The `MockEmailService` captures `templateName` and `html` on each `sendEmail()` call. In tests that check whether emails were sent, use `emailService.getEmailsWithTemplate('template-name')` or check `sentEmail.templateName`.

## Bugs Fixed During Migration

The old `EmailNotificationHandler` had three mismatched template assignments:
- `handleSubscriptionPaused` was sending `subscriptionCancelled.html` — fixed to `SubscriptionPausedEmail`
- `handleSubscriptionDeactivated` was sending `subscriptionCancelled.html` — fixed to `SubscriptionSuspendedEmail`
- `handleSubscriptionDowngraded` was sending `subscriptionCancelled.html` — fixed to `SubscriptionDowngradedEmail`

The old `daily-health-report.mjml` used `{{#if hasFailureReasons}}` Handlebars syntax that the string-replace engine silently ignored (sections never rendered). The new JSX template uses proper React conditionals.

## Files Deleted

- `api/infrastructure/email/mjml/` — MJML compiler and interface
- `api/infrastructure/email/sendgrid/template-parser.ts` — MJML template parser
- `api/templates/mjml/` — 15 MJML template files
- `api/preview/generate-previews.ts` — old HTML preview generator
- `api/preview/email-preview-data.ts` — old preview sample data
