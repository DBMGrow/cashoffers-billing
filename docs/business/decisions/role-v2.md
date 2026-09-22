# Decision: Products Name a Tier (`role_v2`), Not a Role Plus a Premium Bit

## Context

Billing writes `{ role, is_premium, whitelabel_id }` into CashOffers, and matches subscriptions to
products on `whitelabel_code | role | team_members`. That pair has one value for every paid agent:
`role = AGENT`, `is_premium = 1`.

Express Offers introduces three eXp tiers with different prices and different entitlements. Two of
them, Pro at $49 and Elite at $299, are both `AGENT` + `is_premium 1`. So on the columns this repo
reads and writes:

- Their two products **share one reconciliation key**, `EXP|AGENT|0`, and are told apart only by an
  exact price match. A price edit on either one reconciles subscribers onto the other.
- A **plan change between them is invisible**. The `needsUpdate` comparison in
  `cashoffers-account.handler.ts` read both sides as `AGENT` + premium, came out false, and left the
  subscriber on the tier they had stopped paying for, with nothing anywhere reporting it.

This is Q9 of the RBAC unification plan (CO-I271), and it cannot be fixed by being careful. The two
tiers are the same value.

## Decision

`user_config` carries **`role_v2`**, the role in the unified CashOffers vocabulary, and it is
authoritative wherever it appears. The 19 roles are mirrored in
[`api/domain/services/role-v2.ts`](../../../api/domain/services/role-v2.ts) from the mono repo's
`packages/schemas/src/roles/registry.ts`.

```json
{
  "cashoffers": {
    "managed": true,
    "user_config": {
      "role_v2": "AGENT_EXP_ELITE",
      "role": "AGENT",
      "is_premium": 1,
      "is_team_plan": false
    }
  }
}
```

Three consequences, each of which is a rule rather than a preference:

1. **The reconciliation key is `whitelabel_code | role_v2 | team_members`**, with the old key kept as
   a fallback. The new key is finer, so the price check becomes a check rather than the whole answer.
   The fallback is what makes it additive rather than a replacement: see the tradeoff below.
2. **Role writes go to `PUT /users/:id/role`, not to the generic user update.** The main API strips
   `role_v2` from a generic update by design: a role is not profile data, and on that path it is
   derived from `role` and the tier bits, which is exactly the derivation that cannot see Pro become
   Elite. `UserApiClient.updateUser` splits a request carrying `role_v2` so call sites can keep
   stating what they mean.
3. **`role` and `is_premium` stay beside it until Phase 9.** Every read falls back to deriving the
   tier from the legacy pair, so a product that has not been backfilled still works, and this repo
   and the dashboard never have to deploy together.

## Alternatives Considered

- **Keep the pair and add a price dimension to the key.** Makes the price the identity of the
  product, so a promotional price becomes a different product and reconciliation moves subscribers
  every time marketing changes a number.
- **Add an `is_elite` bit beside `is_premium`.** A second axis beside the role is a second permission
  system, and the third tier needs a third bit. Plan Decision 1.
- **Alias Elite to Premium and price it in Square alone.** "Equivalent to a regular user" is an
  entitlement statement, not a billing one. Reporting, reconciliation and alert targeting all still
  need to tell a $299 subscriber from a $25 one, and aliasing is unrecoverable: once the two are one
  value, nothing can separate them again without a per-user audit. Plan Decision 3.

## Tradeoffs

- The role vocabulary is duplicated across two repos. `role-v2.test.ts` pins the properties that
  matter (19 roles, every role maps to a legal v1 role, the eXp tiers are distinct), so drift is a
  failing test rather than a wrong write.
- **The finer key is not a renaming of the old one, and some subscriptions cannot answer it.** On
  staging, 38 live rows have a user whose tier is not the tier their subscription pays for: an agent
  who lapsed to `AGENT_FREE` with a $250 row still open, a subscription whose holder has since become
  a WLADMIN. Those rows record no tier anywhere, so keying strictly on the one available made them
  fail where they used to match. The index therefore keeps the old key as a fallback, used only when
  the tier index finds nothing, which makes the change **strictly additive**: where both sides name a
  tier it is used, and where the subscription cannot name one the match is exactly the one the old
  script made. It cannot reintroduce the Pro/Elite collision, because a subscription naming either
  tier matches on the tier index and never reaches the fallback.

  The dry run reports those rows under `Legacy-role`, and it is the number to watch: they are the
  subscriptions an eXp tier could still be mispriced in. On staging it is 23 of 139, and every
  matched subscription lands on the same product it did before the change.

- Reconciliation reads a **subscription's own config before the user's `role_v2` column**, because
  they answer different questions: the config says what was bought, the column says what the user is
  right now. The other order reconciles a plan against a person.
- **No product becomes an eXp tier by itself.** The backfill derives `role_v2` from
  `(role, is_premium)`, and that mapping has no eXp tier in its range, because `(AGENT, 1)` is the
  ambiguity this decision exists to name. eXp tiers are set by hand, one product at a time, once
  Phase 7.4 settles eXp pricing.

## Impact

- `api/domain/services/role-v2.ts`: the vocabulary, the derivation, the lapse rule
- `api/domain/services/product-matching.ts`: the reconciliation key
- `api/domain/services/product-role-backfill.ts` and `api/scripts/migrate-product-role-v2.ts`
- `api/application/service-handlers/cashoffers/cashoffers-account.handler.ts`: create, renew,
  resume, upgrade and suspension
- `api/infrastructure/external-api/user-api/user-api.client.ts`: the transport split
- Product `user_config` schema in `api/routes/product/schemas.ts`

**Ordering.** The dashboard product form ships first, so a product can carry `role_v2`; then the
backfill; then this. Billing keeps the legacy fallback until plan Phase 9 (U91) removes `role` and
`is_premium` from `user_config` and makes `role_v2` required.
