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

The role a lapse sets comes from the user's white label: `suspension_behavior` picks the branch,
and `Whitelabels.downgrade_role_v2` (RBAC plan §9.5, written and validated by the main API) names
the agent tier.

| `suspension_behavior` | Resulting `role_v2`                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DEACTIVATE_USER`     | `SHELL` (and `is_premium = 0`)                                                                              |
| `DOWNGRADE_TO_FREE`   | The white label's `downgrade_role_v2` for the AGENT family, else `AGENT_FREE`; **no role change** otherwise |

`downgrade_role_v2` is used only when it is an unpaid, assignable AGENT-family tier or `SHELL`
(`validDowngradeRoleV2` in `api/domain/services/role-v2.ts`). Anything else (unset, unknown, a paid
tier, a non-agent role such as `ADMIN`) falls back to `AGENT_FREE`, so a lapse can never keep
someone paid or promote them. Today that makes eXp (`AGENT_EXP_GUEST`) land a lapsed Pro on the
portal view they still qualify for, while KW and every other `DOWNGRADE_TO_FREE` white label
(backfilled to `AGENT_FREE`) behave exactly as before. A `SHELL` downgrade role clears the premium
bit alongside it, for the same reason the `DEACTIVATE_USER` branch does.

`DOWNGRADE_TO_FREE` has never meant "make them a free agent": it cleared the premium bit and left
the role alone. So a lapsing investor, lender or team owner keeps their role and only loses the bit,
whatever the white label's downgrade role says. Reading it as an unconditional agent tier would move
every non-agent into the agent family on lapse, silently, on the one path nobody watches succeed.

The main API derives `role` and `is_premium` from `role_v2` in the same statement, so the
`is_premium: 0` both branches used to write by hand falls out of naming an agent tier.

Billing reads the column with `selectAll`, so a database the main API migration has not reached
answers "unset" (and the lapse falls back to `AGENT_FREE`) rather than failing.

## Why It Exists

Team owners need the `TEAMOWNER` role to manage team members. Single-user accounts revert to the
tier their product sells when leaving a team plan.

## Examples

- "Agent Monthly" (single) → "Team Monthly" (team): `TEAMOWNER`
- "Team Monthly" (team) → "Agent Monthly" (single): the single product's tier, e.g. `AGENT_PREMIUM`
- "ExpressOffers Pro" → "ExpressOffers Elite" (both single): `AGENT_EXP_ELITE`. On the legacy pair
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
