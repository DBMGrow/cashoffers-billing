# Rule: Role Mapping Rules

## Definition
When a user transitions between single-user and team plans, their role in the main API is remapped according to the plan type, not just the product's base role.

## Mapping Logic

| From Plan Type | To Plan Type | Resulting Role |
|---------------|-------------|----------------|
| single | team | TEAMOWNER (always, regardless of product role) |
| team | single | AGENT (always, regardless of product role) |
| same type | same type | Use product's configured role |

## Why It Exists
Team owners need the TEAMOWNER role to manage team members. Single-user accounts should revert to AGENT when leaving a team plan.

## Examples
- User upgrades from "Agent Monthly" (single) to "Team Monthly" (team) → role becomes TEAMOWNER
- User downgrades from "Team Monthly" (team) to "Agent Monthly" (single) → role becomes AGENT
- User stays on "Agent Monthly" and upgrades to "Agent Yearly" (both single) → role stays as product's configured role (AGENT)

## Where Enforced
- `api/domain/services/role-mapper.ts`

## Missing Enforcement
- This mapping is only applied at purchase time for new subscriptions.
- Upgrade/downgrade transitions between existing subscriptions do not yet apply role mapping (future implementation).
