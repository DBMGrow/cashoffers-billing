import { BaseEventHandler } from "@api/infrastructure/events/base-event-handler"
import type { IDomainEvent } from "@api/infrastructure/events/event-bus.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ICommissionApiClient } from "@api/infrastructure/external-api/commission-api.interface"

/**
 * Pushes commission accrual/reversal to api-v2 the moment money moves.
 *
 * Forwards `{ transaction_id }` to api-v2's internal commission endpoints on a
 * settled payment or a refund. Billing owns only this trigger; api-v2 does all
 * the computation.
 *
 * Non-fatal by design: this is a LATENCY optimization, not a correctness
 * guarantee. The api-v2 reconciliation sweep over the shared `Transactions`
 * table accrues anything this push misses, so a failed/dropped push must never
 * fail the wider event processing — hence `safeExecute` (logs, never re-throws).
 *
 * See docs/plans/commission-accrual-push-plan.md.
 */
export class CommissionAccrualHandler extends BaseEventHandler {
  constructor(
    private commissionApiClient: ICommissionApiClient,
    logger: ILogger
  ) {
    super(logger)
  }

  getEventTypes(): string[] {
    // Deliberately NOT "SubscriptionRenewed": a renewal emits BOTH
    // PaymentProcessed and SubscriptionRenewed, which write two Transactions rows
    // (payment + subscription) sharing one Square id but with different internal
    // ids. Subscribing to both would accrue the same sale twice (the api-v2
    // uq_ledger_txn_role key can't dedupe across two transaction_ids).
    // PaymentProcessed fires for one-time charges AND renewals — and its row
    // carries product_id — so it covers everything, exactly once.
    return ["PaymentProcessed", "PaymentRefunded"]
  }

  async handle(event: IDomainEvent): Promise<void> {
    const isRefund = event.eventType === "PaymentRefunded"

    // Refunds carry both the refund txn and the ORIGINAL payment txn — reverse
    // the original. Payments/renewals carry the settled transaction id directly.
    const transactionId: number | undefined = isRefund
      ? event.payload?.originalTransactionId
      : event.payload?.transactionId

    if (transactionId == null) {
      this.logger.warn("commission push skipped: no transaction_id on event", {
        eventType: event.eventType,
        eventId: event.eventId,
      })
      return
    }

    const action = isRefund ? "reverse" : "accrue"

    await this.safeExecute(
      async () => {
        if (isRefund) {
          await this.commissionApiClient.reverse({ transaction_id: transactionId })
        } else {
          await this.commissionApiClient.accrue({ transaction_id: transactionId })
        }
        this.logger.info("commission push ok", { transactionId, action, eventType: event.eventType })
      },
      event,
      "commission push failed (api-v2 sweep will reconcile)"
    )
  }
}
