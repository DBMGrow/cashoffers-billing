# Capability: User Configuration

## Business Outcome
When a user purchases a subscription, their account in the main API is automatically configured with the correct role, premium status, and whitelabel assignment based on the product they purchased.

## Actors
- **User**: Purchases a product
- **System**: Reads product config, creates/updates user in main API

## What Should Happen

### On Purchase (New User)
1. Read `user_config` from `product.data`
2. Create user in main API with:
   - `is_premium` (0 or 1)
   - `role` (AGENT, INVESTOR, ADMIN, TEAMOWNER)
   - `whitelabel_id`
3. Store `user_config` in `subscription.data` for reference

### On Purchase (Existing User)
1. Same as above, but update user instead of create

### On Renewal
- User config is **not updated** — users keep their current state.

### Role Mapping for Plan Transitions
See [Role Mapping Rules](../rules/role-mapping-rules.md).

## Data Structure

**Product.data.user_config**:
```json
{
  "is_premium": 1,
  "role": "AGENT",
  "white_label_id": 1,
  "is_team_plan": false
}
```

**Subscription.data.user_config** — copied from product at purchase time.

## Edge Cases
- Product without `user_config` → purchase still works, no user config is applied
- `white_label_id: null` → user is not assigned to a whitelabel
- `is_team_plan: true` → triggers TEAMOWNER role on single→team upgrade

## Related Rules
- [Role Mapping Rules](../rules/role-mapping-rules.md)

## Related Scenarios
- [New User Purchase](../../development/scenarios/new-user-purchase.md)

## Current vs Intended Behavior
- Upgrade/downgrade user config update is **not yet implemented**.
- Suspension user config revert is **not yet implemented**.
- Backward compatible: old subscriptions without `user_config` continue working.

## Unknowns
- What happens to user config when a subscription is manually deactivated by admin?
