# Whitelabel Email Template Integration

## Overview

Email templates now support whitelabel branding. This guide explains how to:
1. Pass whitelabel information to email templates
2. Update email handlers to fetch whitelabel data
3. Use whitelabel branding in email components

## Current State

### ✅ Completed

- Email templates accept `whitelabel` prop with `WhitelabelBrandingProps` type
- `StandardEmail` component now passes whitelabel to `EmailHeader` and `EmailFooter`
- `EmailHeader` displays whitelabel logo if provided
- `EmailFooter` includes marketing website link if configured
- Updated templates: `subscription-created.email.tsx`, `subscription-renewal.email.tsx`

### 🔄 Next Steps

Email handlers need to be updated to:
1. Fetch whitelabel information for each user
2. Pass whitelabel data to email templates

## Integration Pattern

### Step 1: Update Email Handlers

In `api/application/event-handlers/email-notification.handler.tsx`:

```typescript
import { whitelabelResolverService } from "@api/lib/services"

private async handleSubscriptionCreated(event: SubscriptionCreatedEvent): Promise<void> {
  await this.safeExecute(
    async () => {
      const { email, userId, productName, amount, ... } = event.payload

      // Fetch whitelabel for this user
      const whitelabelInfo = await whitelabelResolverService.resolveForUser(userId)

      const html = await render(
        <SubscriptionCreatedEmail
          subscription={productName}
          amount={this.formatCurrency(amount)}
          lineItems={(lineItems ?? []).map((item) => ({ ... }))}
          date={this.formatDate()}
          isSandbox={this.isSandbox(environment)}
          whitelabel={whitelabelInfo.branding}  // Pass branding
        />
      )
      // ... rest of handler
    },
    event,
    'Failed to send subscription created email'
  )
}
```

### Step 2: Available Whitelabel Properties

The `WhitelabelBrandingProps` interface provides:

```typescript
interface WhitelabelBrandingProps {
  logo_url?: string                // Custom logo for the whitelabel
  primary_color?: string           // Primary brand color
  secondary_color?: string         // Secondary brand color
  marketing_website?: string       // Website to link to in footer
}
```

### Step 3: Whitelabel Resolver Service

Use `whitelabelResolverService` from `api/lib/services.ts`:

```typescript
// Get whitelabel for a user by resolving their subscriptions
const whitelabel = await whitelabelResolverService.resolveForUser(userId)

// Get whitelabel by ID
const whitelabel = await whitelabelResolverService.resolveById(whitelabelId)

// Get whitelabel by code
const whitelabel = await whitelabelResolverService.resolveByCode("kw")
```

Returns: `ResolvedWhitelabel` object with:
- `whitelabel_id`: Numeric ID
- `code`: String code (e.g., "default", "kw")
- `name`: Display name
- `branding`: WhitelabelBrandingProps object

### Step 4: Update All Email Templates

All email templates that use `StandardEmail` should be updated similarly:

```typescript
// Before
export interface PaymentErrorEmailProps {
  amount: string
  errorMessage: string
  // ... other props
}

// After
export interface PaymentErrorEmailProps {
  amount: string
  errorMessage: string
  // ... other props
  whitelabel?: WhitelabelBrandingProps
}
```

## How It Works

### EmailHeader Component
- If `logo` prop provided: displays whitelabel logo image
- If not provided: displays default "CashOffers.PRO" text

### EmailFooter Component
- Adds "Visit our website" link if `marketing_website` is configured
- Falls back to standard CashOffers footer if not whitelabeled

## Database Setup

Before using whitelabel emails:

1. **Add marketing_website to Whitelabels**
   ```bash
   npm run migrate:whitelabel-marketing
   ```

2. **Add user_config to Products**
   ```bash
   npm run migrate:product-config
   ```

This ensures subscriptions have correct `whitelabel_id` in product data, allowing proper resolution.

## Testing

### Email Preview
Generate HTML previews of templates:
```bash
npm run preview:emails
```

Open `email-previews/index.html` to see whitelabel branding applied.

### Mock Whitelabel Data
For testing without database:
```typescript
const mockWhitelabel = {
  logo_url: "https://example.com/logo.png",
  primary_color: "#FF5733",
  secondary_color: "#33FF57",
  marketing_website: "https://example.com"
}

// In test:
<SubscriptionCreatedEmail
  subscription="Test Plan"
  amount="$99.00"
  lineItems={[]}
  date="January 1, 2024"
  whitelabel={mockWhitelabel}
/>
```

## Fallback Behavior

If whitelabel lookup fails or returns null:
- `whitelabel` prop will be undefined
- Components use sensible defaults:
  - Logo: Default "CashOffers.PRO" text
  - Footer: Standard CashOffers footer with no website link
- No errors thrown; emails still send successfully

## Future Enhancements

Possible improvements:
- [ ] Apply primary/secondary colors to email template styling
- [ ] Dynamic email footer text based on whitelabel name
- [ ] Whitelabel-specific email subject lines
- [ ] Support for whitelabel fonts
