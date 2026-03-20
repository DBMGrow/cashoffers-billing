# Data Flow: Purchase

## New User Purchase

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as /api/purchase/new-user
  participant Square
  participant MainAPI as Main API
  participant DB

  FE->>API: POST { productId, cardNonce, email, name, whitelabelId }
  API->>API: Validate product
  API->>Square: CreateCard (tokenize nonce)
  Square-->>API: cardId
  API->>MainAPI: CreateUser (with user_config)
  MainAPI-->>API: userId
  opt signup_fee > 0
    API->>Square: CreatePayment (signup_fee)
    Square-->>API: payment success
    API->>DB: Log transaction
    API->>API: Emit PaymentProcessed → email
  end
  API->>DB: CreateSubscription (next_renewal_at = now + duration)
  API->>API: Emit SubscriptionCreated → confirmation email
  API-->>FE: { subscriptionId, userId }
```

## Existing User Purchase

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as /api/purchase/existing-user
  participant Square
  participant DB

  FE->>API: POST { userId, productId, cardNonce }
  API->>API: Validate product + user
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

## Key Files
- `api/use-cases/subscription/purchase-new-user.use-case.ts`
- `api/use-cases/subscription/purchase-existing-user.use-case.ts`
- `api/routes/purchase/routes.ts`
