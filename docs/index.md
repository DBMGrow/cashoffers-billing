# CashOffers Billing

This is the single source of truth for business logic, system behavior, and development workflow.

---

## Agent Workflow (Read This First)

Before making any change:

1. **Read** the relevant capability or rule doc
2. **Check** the scenario if one exists
3. **Make your changes**
4. **Update** any docs that are now incorrect
5. **Log** discrepancies or todos if you discover anything unclear

Docs must stay current. Code and docs change together.

Truth order when there is a conflict:

1. Decisions (explicit choices made)
2. Business docs (capabilities + rules)
3. Scenarios
4. Code
5. Old docs (treat as suspect)

---

## Structure

```
/docs
  README.md               ← you are here
  /business               ← what the system does and why
    /capabilities         ← user-facing outcomes
    /rules                ← business logic constraints
    /decisions            ← architectural and product choices
  /system                 ← how the system is built
    /components           ← major system pieces
    /integrations         ← external services
    /data-flows           ← request and event flows
  /development            ← how to build and test
    /scenarios            ← key workflows, linked to tests
    /runbooks             ← how to run, test, debug
    /quality              ← coverage tracking, discrepancies, todos
  /templates             ← copy these when adding new docs
```

---

## Business

| Doc                                    | Description                                    |
| -------------------------------------- | ---------------------------------------------- |
| [Capabilities](business/capabilities/) | What the system does from a user perspective   |
| [Rules](business/rules/)               | Constraints and invariants the system enforces |
| [Decisions](business/decisions/)       | Why things are built the way they are          |

---

## System

| Doc                                    | Description                            |
| -------------------------------------- | -------------------------------------- |
| [Architecture](system/architecture) | Layers, tech stack, module structure   |
| [Components](system/components/)       | Major internal components              |
| [Integrations](system/integrations/)   | Square, SendGrid, Main API, HomeUptick |
| [Data Flows](system/data-flows/)       | Key flows: purchase, renewal, webhooks |

---

## Development

| Doc                                 | Description                                     |
| ----------------------------------- | ----------------------------------------------- |
| [Scenarios](development/scenarios/) | Business workflows with test/CLI coverage       |
| [Runbooks](development/runbooks/)   | Local setup, testing, dev tools                 |
| [Quality](development/quality/)     | Integration test coverage, discrepancies, todos |

---

## Quick Reference

```bash
yarn dev              # Start dev server (hot reload)
yarn test             # Run all tests
yarn dev:tools        # Development CLI
yarn preview:emails   # Preview email templates
yarn codegen          # Regenerate DB types from schema
```

Config: never use `process.env` directly — import from `@api/config/config.service`.

Module alias: use `@api/` for all backend imports.

Amounts: always in **cents** (25000 = $250.00).
