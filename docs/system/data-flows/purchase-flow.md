# Data Flow: Purchase

## New User Purchase

```
Frontend (checkout form)
  → POST /api/purchase/new-user
      Body: { productId, cardNonce, email, name, whitelabelId }
  → PurchaseNewUserUseCase
      1. Validate product exists and is available
      2. CreateCardUseCase → Square (tokenize card nonce)
      3. CreateUserUseCase → Main API (create user with user_config)
      4. CreatePaymentUseCase → Square (charge signup_fee if > 0)
         → Log transaction
         → Emit PaymentProcessed → (handler) send email
      5. CreateSubscriptionUseCase
         → Save subscription with next_renewal_at
         → Emit SubscriptionCreated → (handler) send confirmation email
  ← { subscriptionId, userId }
```

## Existing User Purchase

```
Frontend
  → POST /api/purchase/existing-user
      Body: { userId, productId, cardNonce }
  → PurchaseExistingUserUseCase
      1. Validate product and user
      2. CreateCardUseCase (if new card provided)
      3. CalculateProratedUseCase (if upgrading)
      4. CreatePaymentUseCase → Square (charge + prorate)
      5. CreateSubscriptionUseCase
  ← { subscriptionId }
```

## Key Files
- `api/use-cases/subscription/purchase-new-user.use-case.ts`
- `api/use-cases/subscription/purchase-existing-user.use-case.ts`
- `api/routes/purchase/routes.ts`
