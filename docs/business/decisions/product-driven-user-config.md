# Decision: Product-Driven User Configuration

## Context
User roles, premium status, and whitelabel assignments need to change when users buy different subscription plans. Hardcoding this logic would require code changes for every new product.

## Decision
Products store a `user_config` JSON field that defines how a user should be configured when they purchase that product. The billing system reads this config at purchase time and applies it to the user in the main API.

```json
{
  "user_config": {
    "is_premium": 1,
    "role": "AGENT",
    "white_label_id": 1,
    "is_team_plan": false
  }
}
```

## Alternatives Considered
- Hardcode role/premium logic by product ID: fragile, requires code deploys for product changes
- Store config only in main API: creates tight coupling, billing must know about user roles

## Tradeoffs
- Products can be configured without code changes
- `user_config` in `subscription.data` acts as audit trail of what config was applied
- Requires discipline — `user_config` must be set correctly when creating products

## Impact
- All new products should define `user_config` when user configuration matters
- Upgrade/downgrade logic must read new product's `user_config` and apply role mapping
- `api/domain/services/role-mapper.ts` handles the team/single plan transition edge case
- Schema validated in `api/routes/schemas/product.schemas.ts`
