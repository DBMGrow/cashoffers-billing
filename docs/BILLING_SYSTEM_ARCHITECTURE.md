# CashOffers Billing System — Architecture & Go-Live Checklist

> **Status:** Migration planning
> **Last updated:** 2026-03-17
> **Scope:** Complete billing system migration — decoupled subscription lifecycle, CashOffers user management, HomeUptick integration, free trials, webhook sync

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Architecture](#2-module-architecture)
3. [User State Model](#3-user-state-model)
4. [Product Configuration](#4-product-configuration)
5. [Subscription Lifecycle](#5-subscription-lifecycle)
6. [CashOffers Module](#6-cashoffers-module)
7. [HomeUptick Module](#7-homeuptick-module)
8. [Webhook System](#8-webhook-system)
9. [Free Trial System](#9-free-trial-system)
10. [Email Notifications](#10-email-notifications)
11. [Migration Plan](#11-migration-plan)
12. [Go-Live Checklist](#12-go-live-checklist)

---

## 1. System Overview

### Core Principle: Purchase First, Then Provision

The billing system is decoupled from both CashOffers and HomeUptick. Payment and subscription lifecycle management happen independently. After subscription events occur, separate modules react to provision and manage user accounts in each external service.

This means:
- A failed CashOffers user creation does NOT cause a refund or subscription rollback
- A failed HomeUptick API call does NOT block payment processing
- Each service module can fail, retry, and recover independently

### Three Services, One Subscription

A single subscription manages access to both CashOffers and HomeUptick. The product configuration determines what each service does in response to subscription events. At a future date, the system may support multiple subscriptions per user, but that is out of scope for this migration.

### Key Business Rules

- Users are charged **one combined payment** for both services (base subscription + HomeUptick tier charges as line items)
- **HomeUptick is included in CashOffers** — there is no "CashOffers without HomeUptick" product
- **HomeUptick-only products exist** — users can subscribe to HomeUptick without CashOffers premium features
- Some products have **CashOffers managed externally** — billing only manages HomeUptick for these users
- **Billing never sets `active=0`** — only CashOffers admins deactivate users. Billing manages roles and premium status.

---

## 2. Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BILLING SYSTEM                           │
│                                                                 │
│  ┌─────────────────────┐                                        │
│  │  SUBSCRIPTION MODULE │  Pure payment/subscription lifecycle  │
│  │                      │  No knowledge of CashOffers or HU    │
│  │  Use cases:          │                                       │
│  │  - Purchase          │  Publishes events:                    │
│  │  - Renewal           │  → SubscriptionCreated               │
│  │  - Pause/Resume      │  → SubscriptionRenewed               │
│  │  - Cancel            │  → SubscriptionPaused                │
│  │  - Upgrade           │  → SubscriptionResumed               │
│  │  - Prorate calc      │  → SubscriptionDeactivated           │
│  │  - Retry renewal     │  → SubscriptionCancelled             │
│  │  - Card management   │  → PaymentProcessed / PaymentFailed  │
│  │                      │  → CardUpdated                       │
│  └──────────┬───────────┘                                       │
│             │ events                                            │
│             ▼                                                   │
│  ┌──────────────────┐                                           │
│  │    EVENT BUS      │  In-memory, synchronous                  │
│  │                   │  (current implementation)                │
│  └──┬─────┬─────┬───┘                                           │
│     │     │     │                                               │
│     ▼     │     ▼                                               │
│  ┌──────┐ │  ┌────────────┐                                     │
│  │CASH  │ │  │ HOMEUPTICK  │                                     │
│  │OFFERS│ │  │ MODULE      │                                     │
│  │MODULE│ │  │             │                                     │
│  │      │ │  │ Listens to  │                                     │
│  │Listen│ │  │ same events │                                     │
│  │to all│ │  │             │                                     │
│  │sub   │ │  │ Actions:    │                                     │
│  │events│ │  │ -Create acct│                                     │
│  │      │ │  │ -Activate   │                                     │
│  │Action│ │  │ -Deactivate │                                     │
│  │-Creat│ │  │ -Calc tiers │                                     │
│  │ user │ │  │             │                                     │
│  │-Set  │ │  └─────────────┘                                     │
│  │ role │ │                                                      │
│  │-Prem │ │  ┌─────────────────────────┐                         │
│  │ ium  │ │  │ CROSS-CUTTING HANDLERS   │                        │
│  │-SHELL│ └─▶│ - EmailNotification      │                        │
│  │      │    │ - TransactionLogging     │                        │
│  └──────┘    │ - LogFlush              │                        │
│              │ - AdminAlerts            │                        │
│              └─────────────────────────┘                         │
│                                                                 │
│  ┌─────────────────────────────────────┐                         │
│  │  WEBHOOK RECEIVER                    │                        │
│  │  POST /webhooks/cashoffers           │                        │
│  │  - user.deactivated → pause sub     │                        │
│  │  - user.activated → resume sub      │                        │
│  │  - user.created → create free trial │                        │
│  └─────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
api/
├── application/
│   ├── service-handlers/
│   │   ├── cashoffers/
│   │   │   └── cashoffers-account.handler.ts    # Reacts to sub events → manages CO users
│   │   └── homeuptick/
│   │       └── homeuptick-account.handler.ts    # Reacts to sub events → manages HU accounts
│   ├── event-handlers/
│   │   ├── email-notification.handler.tsx       # (existing)
│   │   ├── transaction-logging.handler.ts       # (existing)
│   │   ├── log-flush.handler.ts                 # (existing)
│   │   └── admin-alert.handler.ts               # (new) Emails admin on provisioning failures
│   └── webhook-handlers/
│       └── cashoffers-webhook.handler.ts        # Processes incoming webhooks from main API
├── domain/
│   ├── entities/
│   │   └── subscription.ts                      # (existing) Core business logic
│   ├── events/                                  # (existing) All domain event classes
│   ├── services/
│   │   ├── role-mapper.ts                       # (existing) Role mapping for plan transitions
│   │   └── homeuptick-tier-calculator.ts        # (new) Tier/pricing calculation
│   ├── types/
│   │   └── product-data.types.ts                # (updated) New product config structure
│   └── value-objects/                           # (existing)
├── infrastructure/
│   ├── external-api/
│   │   ├── user-api/                            # (existing) CashOffers main API client
│   │   └── homeuptick-api/
│   │       └── homeuptick-api.client.ts         # (new) HomeUptick API client
│   ├── events/
│   │   └── in-memory-event-bus.ts               # (existing)
│   ├── payment/                                 # (existing) Square integration
│   └── email/                                   # (existing) SendGrid/SMTP
├── routes/
│   ├── webhooks/
│   │   └── routes.ts                            # (new) POST /webhooks/cashoffers
│   ├── subscription/
│   │   └── routes.ts                            # (existing, updated) Add retry-renewal endpoint
│   └── ...                                      # (existing)
└── use-cases/
    └── subscription/                            # (existing, updated)
```

---

## 3. User State Model

### Three Independent Axes

| Axis | Type | Controlled By | Meaning |
|------|------|---------------|---------|
| `active` | boolean | CashOffers admins only | Can the user log in at all? |
| `is_premium` | boolean | Billing system | Does the user have premium CashOffers features? |
| `role` | string | Billing system + admins | What level of access: AGENT, INVESTOR, TEAMOWNER, ADMIN, SHELL |

**Critical rule:** Billing never sets `active=0`. Only CashOffers admin actions set `active=0`. When billing needs to restrict a user, it changes their role to SHELL and/or sets `is_premium=0`.

### The SHELL Role

SHELL means: **"This account exists only for billing portal access and HomeUptick OAuth gateway. No CashOffers features."**

SHELL users:
- Can log in (`active=1`)
- Can manage their subscription, update card, view invoices
- Can OAuth into HomeUptick (if they have an active HU subscription)
- Cannot access any CashOffers premium features
- Have `is_premium=0`

### State Transitions by Scenario

| Scenario | active | is_premium | role | CashOffers Access | HomeUptick Access |
|----------|--------|------------|------|-------------------|-------------------|
| Paying CashOffers+HU user | 1 | 1 | AGENT/INVESTOR/etc | Full premium | Active |
| Paying HomeUptick-only user | 1 | 0 | SHELL | Portal only | Active |
| Suspended — WL: DOWNGRADE_TO_FREE | 1 | 0 | *unchanged* (e.g., AGENT) | Free/limited | Deactivated |
| Suspended — WL: DEACTIVATE_USER | 1 | 0 | SHELL | Portal only | Deactivated |
| Free trial user | 1 | 0 | SHELL | Portal only | Trial (capped contacts) |
| Trial expired, no upgrade | 1 | 0 | SHELL | Portal only | Deactivated |
| Admin-deactivated | 0 | — | — | Blocked | Blocked |
| External CO + active HU sub | 1 | managed externally | managed externally | Managed externally | Active |
| External CO + deactivated | 0 | — | — | Blocked | Auto-suspended |

### Whitelabel Suspension Behavior

Each whitelabel configures what happens to the CashOffers account when a subscription is suspended, cancelled, or expired:

| `suspension_behavior` | Effect on CashOffers Account |
|----------------------|------------------------------|
| `DOWNGRADE_TO_FREE` | Set `is_premium=0`, keep current role. User retains free-tier CashOffers access. |
| `DEACTIVATE_USER` | Set `is_premium=0`, change role to `SHELL`. User loses all CashOffers features, keeps portal + HomeUptick OAuth. |

Both behaviors keep `active=1`. The user can always log in to manage billing and resume.

---

## 4. Product Configuration

### Schema

```typescript
interface ProductData {
  // Pricing
  signup_fee?: number                    // One-time fee in cents
  renewal_cost?: number                  // Recurring cost in cents
  duration?: "daily" | "weekly" | "monthly" | "yearly"
  team_members?: number                  // For team plans

  // CashOffers configuration
  cashoffers?: {
    managed: boolean                     // true = billing manages CO account
                                         // false = CO managed externally
    user_config?: {                      // Only used when managed: true
      is_premium: 0 | 1
      role: "AGENT" | "INVESTOR" | "ADMIN" | "TEAMOWNER" | "SHELL"
      whitelabel_id: number | null
      is_team_plan?: boolean
    }
  }

  // HomeUptick configuration
  homeuptick?: {
    enabled: boolean
    base_contacts?: number               // Included contacts (e.g., 100)
    contacts_per_tier?: number           // Contacts per additional tier (e.g., 1000)
    price_per_tier?: number              // Cost per tier in cents (e.g., 7500 = $75)
    free_trial?: {
      enabled: boolean
      contacts: number                   // Contact limit during trial (e.g., 100)
      duration_days: number              // Trial length (e.g., 90)
    }
  }
}
```

### Product Examples

**CashOffers Premium + HomeUptick (standard plan, ~$250/mo):**
```json
{
  "signup_fee": 0,
  "renewal_cost": 25000,
  "duration": "monthly",
  "cashoffers": {
    "managed": true,
    "user_config": {
      "is_premium": 1,
      "role": "AGENT",
      "whitelabel_id": 4,
      "is_team_plan": false
    }
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 500,
    "contacts_per_tier": 1000,
    "price_per_tier": 7500
  }
}
```

**HomeUptick Only (~$20/mo):**
```json
{
  "signup_fee": 0,
  "renewal_cost": 2000,
  "duration": "monthly",
  "cashoffers": {
    "managed": true,
    "user_config": {
      "is_premium": 0,
      "role": "SHELL",
      "whitelabel_id": 4
    }
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 100,
    "contacts_per_tier": 1000,
    "price_per_tier": 7500
  }
}
```

**External CashOffers + HomeUptick (CO managed outside billing):**
```json
{
  "signup_fee": 0,
  "renewal_cost": 2000,
  "duration": "monthly",
  "cashoffers": {
    "managed": false
  },
  "homeuptick": {
    "enabled": true,
    "base_contacts": 100,
    "contacts_per_tier": 1000,
    "price_per_tier": 7500
  }
}
```

**Free Trial Product (auto-created for free users):**
```json
{
  "signup_fee": 0,
  "renewal_cost": 0,
  "duration": "monthly",
  "cashoffers": {
    "managed": true,
    "user_config": {
      "is_premium": 0,
      "role": "SHELL",
      "whitelabel_id": 4
    }
  },
  "homeuptick": {
    "enabled": true,
    "free_trial": {
      "enabled": true,
      "contacts": 100,
      "duration_days": 90
    }
  }
}
```

### Backward Compatibility

- Products WITHOUT `cashoffers` key: default to `{ managed: true }`, use existing `user_config` at root level
- Products WITHOUT `homeuptick` key: default to `{ enabled: false }`
- Existing `user_config` at root level is read as a fallback when `cashoffers.user_config` is absent

---

## 5. Subscription Lifecycle

### 5.1 Purchase (New User)

```
1. Validate input + product
2. Create card in Square (user_id = null)
3. Process payment (signup_fee + renewal_cost)
4. Create subscription record (status: "active")
5. Bind card to subscription
6. Publish SubscriptionCreated event
   ├── CashOffers Module: Create user via main API with product's user_config
   │   ├── Success: Bind user_id to subscription + card
   │   └── Failure: Email admin, mark for retry (subscription still exists)
   ├── HomeUptick Module: Create HU account if product.homeuptick.enabled
   │   └── Failure: Email admin, mark for retry
   ├── EmailNotification: Send welcome email
   └── TransactionLogging: Log transaction
```

**Key change from current system:** If CashOffers user creation fails, the subscription still exists. No refund, no abandoned user. An admin is notified and provisioning can be retried.

### 5.2 Purchase (Existing User)

```
1. Validate input + product
2. Resolve or create card
3. Process payment
4. Create subscription record
5. Publish SubscriptionCreated event
   ├── CashOffers Module: Update user role/premium if product config differs
   ├── HomeUptick Module: Activate HU account if product.homeuptick.enabled
   ├── EmailNotification: Send welcome email
   └── TransactionLogging: Log transaction
```

### 5.3 Renewal

```
1. Cron finds subscriptions with renewal_date <= now (status = "active" ONLY)
2. Skip if user.active = 0 (inactive users in main API)
3. Build line items:
   a. Base subscription amount
   b. HomeUptick tier charge (if product.homeuptick.enabled)
      - Fetch contact count from HomeUptick API
      - Calculate tier and amount
      - If HomeUptick API fails → FAIL entire renewal, retry later
4. Process single combined payment
5. Update subscription (new renewal_date, clear flags)
6. Publish SubscriptionRenewed event
   ├── CashOffers Module: Ensure is_premium + role are correct
   ├── HomeUptick Module: Ensure HU account is active
   ├── EmailNotification: Send receipt with line items
   └── TransactionLogging: Log transaction with line items
```

**Line item receipt example:**
```
CashOffers Premium (Monthly)    $250.00
HomeUptick — Tier 3 (2,500 contacts)  $150.00
─────────────────────────────────────
Total charged                   $400.00
```

### 5.4 Renewal Failure & Retry

```
Day 0:  Renewal fails
        → Log failed transaction
        → Email user: "Payment failed, retrying in 1 day"
        → Set next_renewal_attempt = today + 1 day

Day 1:  2nd attempt fails
        → Email user: "Payment failed, retrying in 3 days"
        → Set next_renewal_attempt = today + 3 days

Day 4:  3rd attempt fails
        → Email user: "Payment failed, retrying in 7 days"
        → Set next_renewal_attempt = today + 7 days

Day 11: 4th attempt fails
        → SUSPEND subscription (status → "suspend")
        → Record suspension_date = now
        → Stop retrying
        → CashOffers Module: Apply whitelabel suspension behavior
        → HomeUptick Module: Deactivate HU account
        → Email user: "Subscription suspended due to payment failure"
        → Email admin: notification of suspension
```

**Card update triggers immediate retry:**
When a `CardUpdated` event fires, check if user has a subscription with failed payments (has `next_renewal_attempt` set or status = "suspend"). If so, attempt renewal immediately.

**Admin manual retry:**
`POST /subscription/:id/retry-renewal` — forces immediate renewal attempt. Works on any subscription status.

### 5.5 Pause (User-Initiated)

```
1. Validate subscription is active
2. Record suspension_date = now
3. Calculate days_remaining = renewal_date - suspension_date
4. Set status → "suspend"
5. Publish SubscriptionPaused event
   ├── CashOffers Module: Apply whitelabel suspension behavior
   │   ├── DOWNGRADE_TO_FREE: Set is_premium=0, keep role
   │   └── DEACTIVATE_USER: Set is_premium=0, set role=SHELL
   ├── HomeUptick Module: Deactivate HU account
   └── EmailNotification: Send pause confirmation
```

### 5.6 Resume

```
1. Validate subscription is suspended
2. Calculate days_remaining from suspension_date and original renewal_date:
   days_remaining = renewal_date - suspension_date
3. Set new renewal_date = now + days_remaining
4. Set status → "active"
5. Clear suspension_date
6. Publish SubscriptionResumed event
   ├── CashOffers Module: Restore user's product-configured role + is_premium
   ├── HomeUptick Module: Reactivate HU account
   └── EmailNotification: Send resume confirmation with new renewal date
```

**Renewal date adjustment example:**
- Original renewal: March 30
- Paused: March 15 → 15 days remaining
- Resumed: May 16
- New renewal date: May 31 (May 16 + 15 days)

No immediate payment on resume. User pays at the adjusted renewal date.

### 5.7 Cancel on Renewal

The `cancel_on_renewal` flag is the single unified mechanism for both cancellation and downgrade (consolidated — no separate `downgrade_on_renewal`).

```
1. User marks subscription for cancellation
2. Set cancel_on_renewal = 1
3. Subscription remains active until renewal_date
4. Email user: "Your subscription will end on [renewal_date]"
5. User can reverse this before renewal_date (set cancel_on_renewal = 0)

At renewal:
6. Cron detects cancel_on_renewal = 1
7. Set status → "cancel"
8. No charge
9. Publish SubscriptionCancelled event
   ├── CashOffers Module: Apply whitelabel suspension behavior
   ├── HomeUptick Module: Deactivate HU account
   └── EmailNotification: Send cancellation confirmation
```

### 5.8 Immediate Deactivation (Admin Action)

```
1. Admin deactivates subscription
2. Set status → "inactive"
3. Publish SubscriptionDeactivated event
   ├── CashOffers Module: Apply whitelabel suspension behavior
   ├── HomeUptick Module: Deactivate HU account
   └── EmailNotification: Send deactivation notice
```

### 5.9 Upgrade

```
1. Calculate prorated charge (new_cost - old_cost) × (days_remaining / total_days)
2. Process prorated payment
3. Update subscription: new product_id, new amount, new data
4. Apply role mapping:
   - Single → Team plan: role becomes TEAMOWNER
   - Team → Single plan: role becomes AGENT
   - Same plan type: use product's configured role
5. Publish SubscriptionUpgraded event
   ├── CashOffers Module: Update user role + is_premium per new product config
   ├── HomeUptick Module: Update HU config if changed (e.g., new base_contacts)
   └── EmailNotification: Send upgrade confirmation
```

**Valid upgrade paths:**
- HomeUptick-only → CashOffers+HomeUptick (SHELL → AGENT, is_premium → 1)
- CashOffers+HU standard → CashOffers+HU team (AGENT → TEAMOWNER)
- Any plan → higher-priced plan of same type

### 5.10 Subscription Status Reference

| Status | Meaning | Can Renew | Can Pause | Can Cancel | Cron Processes |
|--------|---------|-----------|-----------|------------|----------------|
| `active` | Normal operation | Yes | Yes | Yes | Yes |
| `suspend` | Temporarily paused | No | No | Yes | No |
| `cancel` | Cancelled at renewal | No | No | No | No |
| `inactive` | Admin-deactivated | No | No | No | No |
| `trial` | Free trial period | No* | No | Yes | Yes (expiration) |

*Trial subscriptions don't renew — they expire or get replaced by a paid subscription.

---

## 6. CashOffers Module

**Location:** `api/application/service-handlers/cashoffers/cashoffers-account.handler.ts`

**Responsibility:** Manages CashOffers user accounts in response to subscription events. Replaces the current `PremiumActivationHandler` and `PremiumDeactivationHandler`.

### Event → Action Matrix

| Event | `cashoffers.managed: true` | `cashoffers.managed: false` |
|-------|---------------------------|----------------------------|
| SubscriptionCreated (new user) | Create user with product's role/premium/whitelabel | Skip — do nothing |
| SubscriptionCreated (existing user) | Update role/premium if product config differs | Skip — do nothing |
| SubscriptionRenewed | Ensure correct role + is_premium=1 | Skip — do nothing |
| SubscriptionResumed | Restore product-configured role + is_premium | Skip — do nothing |
| SubscriptionPaused | Apply whitelabel suspension behavior | Skip — do nothing |
| SubscriptionDeactivated | Apply whitelabel suspension behavior | Skip — do nothing |
| SubscriptionCancelled | Apply whitelabel suspension behavior | Skip — do nothing |
| SubscriptionUpgraded | Update role via role-mapper, update is_premium | Skip — do nothing |

### Whitelabel Suspension Behavior (Applied on Pause, Deactivate, Cancel)

```
if whitelabel.suspension_behavior === "DEACTIVATE_USER":
    → Set role = SHELL
    → Set is_premium = 0
    → active remains 1

if whitelabel.suspension_behavior === "DOWNGRADE_TO_FREE":
    → Keep current role (AGENT stays AGENT)
    → Set is_premium = 0
    → active remains 1
```

### Failure Handling

If CashOffers user creation or update fails:
1. Log the error
2. Email admin with details (user ID, subscription ID, intended action, error)
3. Do NOT roll back the subscription — it stays active
4. Admin can investigate and manually fix, or the system retries on next relevant event

---

## 7. HomeUptick Module

**Location:** `api/application/service-handlers/homeuptick/homeuptick-account.handler.ts`

**Responsibility:** Manages HomeUptick accounts in response to subscription events.

### Event → Action Matrix

| Event | `homeuptick.enabled: true` | `homeuptick.enabled: false` |
|-------|---------------------------|----------------------------|
| SubscriptionCreated | Create/activate HU account | Skip |
| SubscriptionRenewed | Ensure HU account is active | Skip |
| SubscriptionResumed | Reactivate HU account | Skip |
| SubscriptionPaused | Deactivate HU account | Skip |
| SubscriptionDeactivated | Deactivate HU account | Skip |
| SubscriptionCancelled | Deactivate HU account | Skip |
| SubscriptionUpgraded | Update HU config (base_contacts, etc.) | Skip |

### HomeUptick Tier Calculation (During Renewal)

```
1. Read product.data.homeuptick config
2. Call HomeUptick API: GET /api/clients/count (with user's api_token)
3. Calculate tier:
   - contacts <= base_contacts → tier 1 → amount = $0
   - contacts > base_contacts → tier = ceil((contacts - base_contacts) / contacts_per_tier) + 1
   - amount = (tier - 1) × price_per_tier
4. Return as line item for combined payment
```

**If HomeUptick API is unreachable:** Fail the entire renewal. It will retry per the standard retry logic (1d → 3d → 7d → suspend).

### HomeUptick API Client

**Location:** `api/infrastructure/external-api/homeuptick-api/homeuptick-api.client.ts`

Required operations:
- `createAccount(userId, config)` — Create a HomeUptick account for a user
- `activateAccount(userId)` — Reactivate a deactivated account
- `deactivateAccount(userId)` — Deactivate an account (user loses access)
- `getClientCount(apiToken)` — Get contact count for tier calculation
- `setContactLimit(userId, limit)` — Set contact cap (for free trials)

### Failure Handling

If HomeUptick account creation or update fails:
1. Log the error
2. Email admin
3. Do NOT roll back the subscription
4. Subscription stays active; admin investigates

---

## 8. Webhook System

### Incoming Webhooks from CashOffers Main API

**Endpoint:** `POST /webhooks/cashoffers`
**Auth:** Shared secret (HMAC signature verification)

| Webhook Event | Billing Action |
|---------------|----------------|
| `user.deactivated` | Pause (suspend) the user's subscription. This prevents billing for services they can't access. If `cashoffers.managed: false`, still pause — user can't OAuth into HomeUptick with a deactivated CO account. |
| `user.activated` | Resume the user's subscription (if it was paused by deactivation). Renewal date adjusted for time inactive. |
| `user.created` | If the user is a free user, auto-create a HomeUptick free trial subscription. |

### Webhook Payload Format

```json
{
  "event": "user.deactivated",
  "timestamp": "2026-03-17T12:00:00Z",
  "data": {
    "user_id": 12345,
    "email": "user@example.com",
    "reason": "admin_action"
  },
  "signature": "hmac-sha256-signature"
}
```

### Webhook Security

- Verify HMAC-SHA256 signature using shared secret
- Reject requests with invalid or missing signatures
- Log all webhook events for audit trail
- Idempotent handling (same event processed twice = same result)

---

## 9. Free Trial System

### How Free Trials Work

1. **Trigger:** CashOffers main API sends `user.created` webhook when a free user signs up
2. **Billing creates a trial subscription:**
   - Product: the designated free trial product
   - Status: `trial`
   - Amount: $0
   - Renewal date: now + 90 days (configurable via `product.homeuptick.free_trial.duration_days`)
3. **HomeUptick Module** receives `SubscriptionCreated`, sees free trial config:
   - Creates HomeUptick account
   - Sets contact limit to 100 (configurable via `product.homeuptick.free_trial.contacts`)
4. **CashOffers Module** receives `SubscriptionCreated`:
   - Creates/confirms SHELL account (free users need a CO account for OAuth)

### Trial Expiration

5. **Day ~80:** Email notification: "Your HomeUptick trial expires in 10 days. Upgrade to keep access."
6. **Day 90:** Renewal cron processes the trial:
   - Trial subscription status → `cancel` (expired)
   - HomeUptick Module: deactivate HU account
   - Email: "Your free trial has ended. Upgrade to continue using HomeUptick."

### Trial Upgrade

- Users can upgrade from trial to a paid plan at any time
- No proration for remaining trial time — upgrade at full price immediately
- Trial subscription is replaced by the paid subscription
- HomeUptick contact limit is lifted to match new product config

### Trial Constraints

- One active trial per user
- Trial cannot be paused or resumed
- Trial cannot be extended (unless admin manually adjusts renewal_date)
- If user already has a paid subscription, no trial is created

---

## 10. Email Notifications

All emails support whitelabel branding. Sandbox emails are prefixed with `[SANDBOX]`.

| Event | Email | Content |
|-------|-------|---------|
| SubscriptionCreated | Welcome email | Plan details, getting started info |
| SubscriptionRenewed | Renewal receipt | Line items (base + HU tier), total charged, next renewal date |
| PaymentFailed (1st) | Payment failed | "We'll retry in 1 day. Update your card at [billing portal link]." |
| PaymentFailed (2nd) | Payment failed | "We'll retry in 3 days." |
| PaymentFailed (3rd) | Payment failed | "Final retry in 7 days. Update your card to avoid suspension." |
| SubscriptionSuspended | Suspension notice | "Your subscription has been suspended. Update your card to reactivate." |
| SubscriptionPaused | Pause confirmation | "Paused. Resume anytime from your billing portal." |
| SubscriptionResumed | Resume confirmation | "Resumed. Your next renewal date is [date]." |
| SubscriptionCancelled (marked) | Cancellation scheduled | "Your subscription will end on [date]. Change your mind? Resume from billing portal." |
| SubscriptionCancelled (at renewal) | Cancellation complete | "Your subscription has ended." |
| SubscriptionDeactivated | Deactivation notice | "Your subscription has been deactivated." |
| SubscriptionUpgraded | Upgrade confirmation | New plan details, prorated charge |
| CardUpdated | Card updated | "Card ending in [last4] is now on file." |
| Trial created | Trial welcome | "You have 90 days of free HomeUptick access with 100 contacts." |
| Trial expiring (10 days) | Trial warning | "Your trial ends in 10 days. Upgrade to keep access." |
| Trial expired | Trial ended | "Your free trial has ended. Upgrade to continue." |
| Provisioning failure | Admin alert (admin only) | User ID, subscription ID, what failed, error details |

---

## 11. Migration Plan

### Strategy: Big Bang

All changes go live at once. Both CashOffers and HomeUptick are live systems with active users — zero service disruption is required.

### Pre-Migration Steps

1. **Update product configs:** Add `cashoffers` and `homeuptick` fields to all existing products
2. **Migrate HomeUptick_Subscriptions data:** Move tier configuration (base_contacts, contacts_per_tier, price_per_tier) into the corresponding product's `data.homeuptick` field
3. **Keep `Homeuptick_Subscriptions` table:** Do not drop. Keep as a reference/fallback during transition.
4. **Add SHELL role to CashOffers main API:** The main API must recognize SHELL as a valid role before billing starts assigning it
5. **Implement webhook endpoint in billing** and configure main API to send webhooks
6. **Implement HomeUptick API client** with all required operations
7. **Add `suspension_date` tracking** to pause/resume use cases (field exists in schema already)

### Migration Execution

1. Deploy updated billing system with all new modules
2. Run product config migration script (adds `cashoffers` + `homeuptick` to existing products)
3. Run HomeUptick_Subscriptions → product config migration script
4. Enable webhook sending from CashOffers main API
5. Verify: existing renewals still work (backward compat)
6. Verify: new purchases use new product config
7. Verify: HomeUptick charges appear as line items on next renewal cycle

### Rollback Plan

- New modules are additive (new event handlers alongside existing ones)
- Feature flag: if CashOffers module fails, fall back to existing PremiumActivation/DeactivationHandlers
- Products without new config fields use existing behavior (backward compat)
- Webhook endpoint can be disabled independently

---

## 12. Go-Live Checklist

### A. Product Configuration
- [ ] **A1.** `ProductData` type updated with `cashoffers` and `homeuptick` schemas
- [ ] **A2.** Product validation schema updated (Zod)
- [ ] **A3.** All existing products migrated to new config structure
- [ ] **A4.** Backward compat: products without new fields work with old behavior
- [ ] **A5.** SHELL role recognized by CashOffers main API
- [ ] **A6.** HomeUptick_Subscriptions data migrated to product configs
- [ ] **A7.** At least one HomeUptick-only product created and tested
- [ ] **A8.** At least one external-CashOffers product created and tested
- [ ] **A9.** Free trial product created and tested

### B. Subscription Module
- [ ] **B1.** Purchase (new user): payment processed, subscription created, events published — user creation moved to event handler
- [ ] **B2.** Purchase (existing user): same decoupled flow
- [ ] **B3.** Renewal: HomeUptick tier charges included as line items
- [ ] **B4.** Renewal: single combined payment for both services
- [ ] **B5.** Renewal: if HomeUptick API fails, entire renewal fails and retries
- [ ] **B6.** Retry logic: 1d → 3d → 7d → suspend (11 days total)
- [ ] **B7.** After suspension from failed payments, stop retrying
- [ ] **B8.** Card update triggers immediate renewal retry
- [ ] **B9.** Admin endpoint: `POST /subscription/:id/retry-renewal`
- [ ] **B10.** Pause: records suspension_date, calculates days_remaining
- [ ] **B11.** Resume: adjusts renewal_date based on time inactive
- [ ] **B12.** Resume: no immediate payment, waits for adjusted renewal date
- [ ] **B13.** Cancel on renewal: unified flag (replaces both cancel + downgrade)
- [ ] **B14.** `downgrade_on_renewal` field deprecated / consolidated into `cancel_on_renewal`
- [ ] **B15.** Cron only processes `active` subscriptions (not `suspend`)
- [ ] **B16.** Trial subscriptions: created with status `trial`, expire at renewal_date
- [ ] **B17.** Trial upgrade: replaces trial with paid subscription, no proration for trial time

### C. CashOffers Module
- [ ] **C1.** Handler created: `cashoffers-account.handler.ts`
- [ ] **C2.** Subscribes to all subscription lifecycle events
- [ ] **C3.** Checks `cashoffers.managed` flag — skips if `false`
- [ ] **C4.** SubscriptionCreated (new user): creates user via main API with product config
- [ ] **C5.** SubscriptionCreated (existing user): updates role/premium if needed
- [ ] **C6.** SubscriptionRenewed: ensures correct role + is_premium
- [ ] **C7.** SubscriptionPaused: applies whitelabel suspension behavior
- [ ] **C8.** SubscriptionDeactivated: applies whitelabel suspension behavior
- [ ] **C9.** SubscriptionCancelled: applies whitelabel suspension behavior
- [ ] **C10.** SubscriptionResumed: restores product-configured role + is_premium
- [ ] **C11.** SubscriptionUpgraded: applies role-mapper logic
- [ ] **C12.** Failure → emails admin, does NOT roll back subscription
- [ ] **C13.** Old PremiumActivationHandler and PremiumDeactivationHandler removed/replaced

### D. HomeUptick Module
- [ ] **D1.** Handler created: `homeuptick-account.handler.ts`
- [ ] **D2.** Subscribes to all subscription lifecycle events
- [ ] **D3.** Checks `homeuptick.enabled` flag — skips if `false`
- [ ] **D4.** SubscriptionCreated: creates/activates HU account
- [ ] **D5.** SubscriptionRenewed: ensures HU account is active
- [ ] **D6.** SubscriptionPaused: deactivates HU account
- [ ] **D7.** SubscriptionDeactivated: deactivates HU account
- [ ] **D8.** SubscriptionCancelled: deactivates HU account
- [ ] **D9.** SubscriptionResumed: reactivates HU account
- [ ] **D10.** SubscriptionUpgraded: updates HU config if changed
- [ ] **D11.** Failure → emails admin, does NOT roll back subscription

### E. HomeUptick API Client
- [ ] **E1.** `homeuptick-api.client.ts` created
- [ ] **E2.** `createAccount(userId, config)` implemented
- [ ] **E3.** `activateAccount(userId)` implemented
- [ ] **E4.** `deactivateAccount(userId)` implemented
- [ ] **E5.** `getClientCount(apiToken)` implemented
- [ ] **E6.** `setContactLimit(userId, limit)` implemented
- [ ] **E7.** Error handling: returns structured errors, does not throw unexpectedly

### F. HomeUptick Tier Calculation
- [ ] **F1.** Tier calculator reads from product config (not Homeuptick_Subscriptions table)
- [ ] **F2.** Tier calculation integrated into renewal use case
- [ ] **F3.** Tier charge appears as a line item on combined payment
- [ ] **F4.** Receipt email shows both base subscription and HU tier line items
- [ ] **F5.** Edge case: 0 contacts → $0 HU charge (tier 1, no addon)
- [ ] **F6.** Edge case: HU API unreachable → renewal fails, retries

### G. Webhook System
- [ ] **G1.** `POST /webhooks/cashoffers` endpoint created
- [ ] **G2.** HMAC-SHA256 signature verification
- [ ] **G3.** `user.deactivated` → pauses subscription
- [ ] **G4.** `user.activated` → resumes subscription (with renewal date adjustment)
- [ ] **G5.** `user.created` (free user) → creates free trial subscription
- [ ] **G6.** Idempotent handling (duplicate webhooks safe)
- [ ] **G7.** All webhook events logged for audit
- [ ] **G8.** External CO subscriptions: `user.deactivated` still pauses HU sub (can't OAuth)
- [ ] **G9.** CashOffers main API configured to send webhooks

### H. Free Trial
- [ ] **H1.** Trial subscription created automatically on free user signup (via webhook)
- [ ] **H2.** Trial status: `trial`, amount: $0, renewal_date: now + 90 days
- [ ] **H3.** HomeUptick account created with contact limit (100)
- [ ] **H4.** CashOffers SHELL account created/confirmed
- [ ] **H5.** Trial expiration email at ~10 days before end
- [ ] **H6.** Trial expiration: subscription cancelled, HU deactivated
- [ ] **H7.** Trial upgrade: replaces trial with paid subscription immediately
- [ ] **H8.** One trial per user (no duplicate trials)
- [ ] **H9.** No trial if user already has a paid subscription

### I. Email Notifications
- [ ] **I1.** Renewal receipt includes line items (base + HU tier)
- [ ] **I2.** Payment failure emails escalate messaging (1st, 2nd, 3rd, suspension)
- [ ] **I3.** Resume email includes adjusted renewal date
- [ ] **I4.** Trial welcome email
- [ ] **I5.** Trial expiration warning email (10 days before)
- [ ] **I6.** Trial expired email
- [ ] **I7.** Admin alert email on provisioning failure (CO or HU)
- [ ] **I8.** All emails support whitelabel branding

### J. Data Migration
- [ ] **J1.** Migration script: add `cashoffers` + `homeuptick` to all product configs
- [ ] **J2.** Migration script: copy Homeuptick_Subscriptions tier config into product configs
- [ ] **J3.** Homeuptick_Subscriptions table preserved (not dropped)
- [ ] **J4.** Existing subscriptions continue to work without config changes
- [ ] **J5.** Verify: existing renewals process correctly post-migration
- [ ] **J6.** Verify: existing pause/resume works post-migration
- [ ] **J7.** Verify: existing cancel-on-renewal works post-migration

### K. Admin & Operations
- [ ] **K1.** Admin retry endpoint: `POST /subscription/:id/retry-renewal`
- [ ] **K2.** Admin can view subscription provisioning status (CO + HU)
- [ ] **K3.** Admin receives email on provisioning failures
- [ ] **K4.** Admin receives email on subscription suspensions (payment failure)
- [ ] **K5.** Logging: all module actions logged with subscription_id, user_id, action, result

### L. Testing & Validation
- [ ] **L1.** Unit tests: tier calculation with various contact counts
- [ ] **L2.** Unit tests: renewal date adjustment on resume
- [ ] **L3.** Unit tests: retry logic → suspension at 11 days
- [ ] **L4.** Unit tests: product config backward compatibility
- [ ] **L5.** Integration test: full purchase flow (new user, CashOffers+HU product)
- [ ] **L6.** Integration test: full purchase flow (HomeUptick-only product)
- [ ] **L7.** Integration test: full purchase flow (external CashOffers product)
- [ ] **L8.** Integration test: renewal with HU tier charges
- [ ] **L9.** Integration test: pause → resume → verify renewal date adjusted
- [ ] **L10.** Integration test: cancel on renewal → verify both services deactivated
- [ ] **L11.** Integration test: webhook user.deactivated → subscription paused
- [ ] **L12.** Integration test: webhook user.created → trial created
- [ ] **L13.** Integration test: card update → immediate renewal retry
- [ ] **L14.** Integration test: trial expiration
- [ ] **L15.** Integration test: trial upgrade to paid
- [ ] **L16.** Smoke test: existing production subscriptions renew correctly
- [ ] **L17.** Smoke test: existing pause/resume works
- [ ] **L18.** Smoke test: no service disruption for active users
