# Rule: Role Mapping Rules

## Definition

When a user transitions between single-user and team plans, their role in the main API is remapped according to the plan type, not just the product's base role.

## Mapping Logic

| From Plan Type | To Plan Type | Resulting `role_v2`                         |
| -------------- | ------------ | ------------------------------------------- |
| single         | team         | `TEAMOWNER` (always, regardless of product) |
| team           | single       | The new product's tier (see below)          |
| same type      | same type    | The new product's tier                      |

Team roles are not multiplied by tier: there is one `TEAMOWNER`, not one per tier, because
`team_accounts` is a capability and a team owner is already tier-implied (RBAC plan Decision 4).

### Why team → single no longer returns a literal `AGENT`

The legacy mapper returned `"AGENT"` here and let `is_premium` carry the tier. In the unified
vocabulary `AGENT` is a legal role but an **unassignable** one: it is what a user is before anyone
has said which tier they are on, and deliberately putting a paying subscriber there would leave them
with a free agent's capabilities. The product they moved onto is what knows what they bought, so
that is the answer. For every product that exists today the two agree, a single plan's config is
`AGENT` + `is_premium 1`, which resolves to `AGENT_PREMIUM`.

## Which Source Wins

| Direction                              | Source of truth                              | Why                                                                 |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Subscription created, renewed, resumed | The **product's** `user_config.role_v2`      | The product says what was bought                                    |
| Plan changed (upgrade or downgrade)    | The **new product's** config, via the mapper | Same reason, plus the team/single rule above                        |
| Subscription lapsed                    | The **white label's** lapse behavior         | Nobody buys a downgrade; the white label decides what a lapse means |

This asymmetry is why re-subscribing restores the right tier without anyone storing the old one.

## Lapse Behavior

`suspension_behavior` on the white label is already a role mapping in disguise:

| `suspension_behavior` | Resulting `role_v2`                                             |
| --------------------- | --------------------------------------------------------------- |
| `DEACTIVATE_USER`     | `SHELL`                                                         |
| `DOWNGRADE_TO_FREE`   | `AGENT_FREE` for the AGENT family; **no role change** otherwise |

`DOWNGRADE_TO_FREE` has never meant "make them a free agent": it cleared the premium bit and left
the role alone. So a lapsing investor, lender or team owner keeps their role and only loses the bit.
Reading it as an unconditional `AGENT_FREE` would move every non-agent into the agent family on
lapse, silently, on the one path nobody watches succeed.

The main API derives `role` and `is_premium` from `role_v2` in the same statement, so the
`is_premium: 0` both branches used to write by hand now falls out of naming the role.

**Planned:** RBAC plan §9.5 replaces the enum with a `Whitelabels.downgrade_role_v2` column, so eXp
can land a lapsed Pro on `AGENT_EXP_GUEST` (the portal view they still qualify for) rather than on
a CashOffers free account they never signed up for. The column does not exist yet; the table above
is its default when it does.

## Why It Exists

Team owners need the `TEAMOWNER` role to manage team members. Single-user accounts revert to the
tier their product sells when leaving a team plan.

## Examples

- "Agent Monthly" (single) → "Team Monthly" (team): `TEAMOWNER`
- "Team Monthly" (team) → "Agent Monthly" (single): the single product's tier, e.g. `AGENT_PREMIUM`
- "Express Offers Pro" → "Express Offers Elite" (both single): `AGENT_EXP_ELITE`. On the legacy pair
  this transition was invisible, because both products are `AGENT` + `is_premium 1`.

## Where Enforced

- `api/domain/services/role-mapper.ts`: `mapRoleV2ForTransition`
- `api/domain/services/role-v2.ts`: `downgradeRoleV2For`, and the vocabulary itself
- `api/application/service-handlers/cashoffers/cashoffers-account.handler.ts`: `applyDowngrade`

## Missing Enforcement

- Team **members** are still restored with a legacy `role = AGENT` write on renewal and resume. That
  is deliberate: the main API's derivation guard makes it a no-op for a member who is separately on
  a paid tier, where naming `role_v2` would flatten them. Converting it needs each member's own role
  read first, which is §9.5's work.
- Nothing yet verifies that a product's `role_v2` is a role the white label it belongs to should be
  selling. The product form filters; the API validates the role exists and is assignable.
