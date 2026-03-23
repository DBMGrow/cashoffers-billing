# Data Flow: Purchase

## New User Purchase

Payment-first architecture: the subscription is created before the user account.
If user provisioning fails, the subscription and transaction still exist — no refund
is issued, and the admin is alerted for manual intervention.

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as /api/purchase/new
  participant Square
  participant DB
  participant MainAPI as Main API

  FE->>API: POST { productId, cardNonce, email, name, ... }
  API->>API: Validate input + product
  API->>Square: CreateCard (tokenize nonce)
  Square-->>API: cardId
  API->>Square: CreatePayment (signup_fee + renewal_cost)
  Square-->>API: payment success
  API->>DB: CreateSubscription (user_id=null, provisioning_status=null)
  API->>DB: CreateTransaction (user_id=null)
  API->>MainAPI: CreateUser (with user_config)
  alt Provisioning succeeds
    MainAPI-->>API: userId
    API->>DB: Update subscription (user_id=userId, provisioning_status='provisioned')
    API->>DB: Update card (user_id=userId)
    API->>API: Emit UserCreated
    API-->>FE: { success, userProvisioned: true, user, ... }
  else Provisioning fails
    MainAPI-->>API: error
    API->>DB: Update subscription (provisioning_status='pending_provisioning')
    API->>API: Emit UserProvisioningFailed
    API->>API: Send admin alert email
    API-->>FE: { success, userProvisioned: false, user: null, ... }
  end
  API->>API: Emit SubscriptionCreated, PaymentProcessed, PurchaseRequestCompleted
```

### Refund Logic

| Failure point | Refund? |
|---|---|
| Before payment (card creation, product validation) | N/A — nothing charged |
| Payment fails | N/A — Square did not complete |
| After payment, before subscription created | Yes — subscription does not exist yet |
| After subscription created (user provisioning, events) | **No** — subscription is the source of truth |

### Pending Provisioning

When `userProvisioned: false` is returned:
- The customer was charged and has a subscription record
- No user account exists yet — they cannot log in
- Admin receives an alert email with subscription ID, purchase request ID, and customer email
- A `UserProvisioningFailed` event is emitted for monitoring
- The subscription has `provisioning_status = 'pending_provisioning'` and `user_id = null`
- The cron job excludes these subscriptions from renewal processing

---

## Existing User Purchase

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as /api/purchase/existing
  participant Square
  participant DB

  FE->>API: POST { userId, productId, cardNonce }
  API->>API: Validate product + user (from session)
  opt new card provided
    API->>Square: CreateCard
    Square-->>API: cardId
  end
  opt upgrading
    API->>API: CalculateProrated
  end
  API->>Square: CreatePayment (charge + prorate)
  Square-->>API: payment success
  API->>DB: CreateSubscription
  API-->>FE: { subscriptionId }
```

---

## Key Files

- `api/use-cases/subscription/purchase-new-user.use-case.ts`
- `api/use-cases/subscription/purchase-existing-user.use-case.ts`
- `api/routes/purchase/routes.ts`
- `api/database/migrations/007_subscriptions_nullable_user_id.sql`
- `api/domain/events/user-provisioning-failed.event.ts`
