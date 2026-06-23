# Commission Accrual Push Plan (billing side)

**Date:** 2026-06-23
**Status:** Draft
**Scope:** Add a thin event handler that notifies the CashOffers api-v2 commission system the instant a transaction succeeds or is refunded, so commissions accrue in near-real-time. The billing service owns **only the trigger**; all commission computation, hierarchy, schedules, ledger, and reporting live in api-v2.

> Companion to the api-v2 plan `docs/plans/commission-tracking-plan.md` in `cashoffers-dashboard-mono` (PR #639). Read that for the commission model (white-label hierarchy, 20/10/20 split, ledger, reconciliation, payout gate). This document covers **only** the billing repo's contribution.

---

## 1. Overview

### Why billing is involved

The billing service is the authoritative source of truth for the transaction lifecycle — it writes every `Transactions` row (Square payments, subscription renewals, refunds) and emits clean domain events. The commission system in api-v2 needs to know when those events happen.

Because billing and api-v2 **share the same `cashoffersdb1` database**, api-v2 already has a **reconciliation sweep** over the shared `Transactions` table that guarantees every transaction eventually accrues — with **zero billing changes**. This plan adds a **near-real-time push** on top of that backstop so affiliates see earnings within seconds rather than at the next sweep.

**What billing does NOT do:** it does not compute commissions, read the white-label hierarchy, or write the commission ledger. Those are api-v2's domain. Billing only forwards "transaction X happened" / "transaction X was reversed."

### Design rule

Per `AGENTS.md` rule 6 (production-from-the-start: validation, error handling, logging, observability) this handler ships with structured logging and a failure signal from day one, and is explicitly designed so that a **dropped or failed push never loses a commission** — the api-v2 sweep reconciles it. Correctness does not depend on this push succeeding; only latency does.

---

## 2. The handler

**New file:** `api/application/event-handlers/commission-accrual.handler.ts`

A `BaseEventHandler` subscribing to the three events that represent money moving:

| Event | api-v2 call | Payload |
|-------|-------------|---------|
| `PaymentProcessedEvent` | `POST /internal/commissions/accrue` | `{ transaction_id }` |
| `SubscriptionRenewedEvent` | `POST /internal/commissions/accrue` | `{ transaction_id }` (one per created transaction; renewals create a payment + subscription row — accrue the subscription transaction) |
| `PaymentRefundedEvent` | `POST /internal/commissions/reverse` | `{ transaction_id: originalTransactionId }` |

```ts
export class CommissionAccrualHandler extends BaseEventHandler {
  getEventTypes(): string[] {
    return ["PaymentProcessed", "SubscriptionRenewed", "PaymentRefunded"]
  }

  async handle(event: IDomainEvent): Promise<void> {
    const txnId = resolveTransactionId(event)          // from event payload
    if (!txnId) { this.logger.warn("commission push skipped: no transaction_id", { event: event.type }); return }

    const action = event.type === "PaymentRefunded" ? "reverse" : "accrue"
    await this.commissionApiClient[action]({ transaction_id: txnId })
      .then(() => this.logger.info("commission push ok", { txnId, action }))
      .catch((err) => {
        // Non-fatal: the api-v2 reconciliation sweep will accrue this txn later.
        this.logger.error("commission push failed (sweep will reconcile)", { txnId, action, err })
        this.metrics.increment("commission_push_failed")
      })
  }
}
```

**Event payload prerequisite:** the handler needs the created `transaction_id`. `PaymentRefundedEvent` already carries `originalTransactionId`. `PaymentProcessedEvent` / `SubscriptionRenewedEvent` are created right after the transaction is written in their use-cases (`create-payment.use-case.ts`, `renew-subscription.use-case.ts`), which already have the `transaction_id` in hand — **enhance those event payloads to include `transactionId`** if not already present. Small, additive change.

---

## 3. The outbound client

**New file:** `api/infrastructure/external-api/commission-api.client.ts` (+ interface)

Mirrors the existing api-v2 outbound pattern used by `CashOffersAccountHandler` → `user-api.interface.ts`. Two methods:

```ts
interface CommissionApiClient {
  accrue(input: { transaction_id: number }): Promise<void>
  reverse(input: { transaction_id: number }): Promise<void>
}
```

- Targets api-v2 `POST {API_ROUTE_V2}/internal/commissions/accrue` and `/reverse`.
- Authenticates with the existing internal service token (`API_TOKEN_INTERNAL`) — same mechanism the user-API client uses.
- Short timeout; failures are swallowed-with-logging (the sweep is the safety net). Never throws into the event bus in a way that blocks the HTTP response (the in-memory bus already runs handlers with `Promise.allSettled`, but we fail soft anyway).

---

## 4. Registration

**Modified:** `api/lib/services.ts` (handler wire-up, ~lines 85–127)

```ts
const commissionAccrualHandler = new CommissionAccrualHandler(commissionApiClient, logger, metrics)
eventBus.subscribe("PaymentProcessed", commissionAccrualHandler)
eventBus.subscribe("SubscriptionRenewed", commissionAccrualHandler)
eventBus.subscribe("PaymentRefunded", commissionAccrualHandler)
```

---

## 5. Observability & Correctness (built in, not bolted on)

- **Structured logs** on every push: `info` on success, `error` on failure — both tagged with `transaction_id` and `action`.
- **Failure metric** `commission_push_failed` so a spike in failed pushes is visible without waiting for someone to notice missing earnings.
- **Correctness is independent of the push.** The api-v2 reconciliation sweep over the shared `Transactions` table is the guarantee; this handler is a latency optimization. A failed push degrades freshness, never correctness — and the api-v2 `GET /commissions/health` endpoint will still show the transaction as accrued once the sweep runs.
- **Verification proves the safety net:** an integration test simulates a push failure (api-v2 unreachable) and asserts the event handler does not throw and the failure is logged + counted — i.e. the system tolerates the drop by design.

---

## 6. Out of scope

- **Commission computation, hierarchy, schedules, ledger, reporting, payout** — all api-v2 (PR #639).
- **Square chargeback/dispute webhook** — neither service handles Square disputes today. Refunds (`PaymentRefundedEvent`) are the reversal trigger for now; a Square `dispute.created` webhook handler is a **later increment** in this repo (tracked in `docs/development/quality/todos.md`).
- **Schema changes** — none in this repo; the commission tables live in api-v2.

---

## 7. Files

### New
| File | Purpose |
|------|---------|
| `api/application/event-handlers/commission-accrual.handler.ts` | Subscribe to payment/renewal/refund events, push to api-v2 |
| `api/infrastructure/external-api/commission-api.client.ts` (+ interface) | Outbound api-v2 `/internal/commissions/*` client |
| `api/application/event-handlers/commission-accrual.handler.test.ts` | Unit + integration tests |

### Modified
| File | Change |
|------|--------|
| `api/lib/services.ts` | Register the handler against the three events |
| `api/domain/events/payment-processed.event.ts` | Include `transactionId` in payload (if absent) |
| `api/domain/events/subscription-renewed.event.ts` | Include `transactionId` in payload (if absent) |
| `docs/development/quality/todos.md` | Note the deferred Square dispute webhook |

---

## 8. Testing

- **Unit:** each event type maps to the correct api-v2 call + payload; missing `transaction_id` is skipped with a warning.
- **Integration:** handler invokes the outbound client with the internal token; on a simulated api-v2 outage the handler logs + increments the failure metric and does **not** throw.
- Run via the repo's Vitest config (`vitest.config.api.ts`).

---

## 9. Rollout

- This handler is inert until api-v2 ships `POST /internal/commissions/accrue|reverse` (api-v2 Phase 3). Until then it can be registered but the api-v2 route returns 404, which the handler treats as a (logged, non-fatal) failure — the sweep still reconciles. Coordinate deploy so the api-v2 route exists first, or land this handler dark behind the api-v2 endpoint's availability.
- No user-facing behavior in this repo; safe to ship incrementally.
