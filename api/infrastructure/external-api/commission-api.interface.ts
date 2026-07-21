/**
 * Commission API Client Interface
 *
 * Thin outbound client that notifies the CashOffers api-v2 commission system
 * when a transaction should accrue (or reverse) a commission. Billing owns ONLY
 * the trigger — all commission computation (hierarchy, schedules, ledger) lives
 * in api-v2. See docs/plans/commission-accrual-push-plan.md.
 */

export interface CommissionAccrualInput {
  /** Internal CashOffers transaction id (Transactions.transaction_id). */
  transaction_id: number
  /**
   * Refunded amount in cents. Required by api-v2 `/internal/commissions/reverse`
   * (it recomputes net revenue as gross − platform_fee − chargeback_amount, so a
   * partial refund reverses the commission proportionally). Omitted for accrue.
   */
  chargeback_amount?: number
}

export interface ICommissionApiClient {
  /** Accrue commission for a settled transaction (payment / subscription renewal). */
  accrue(input: CommissionAccrualInput): Promise<void>

  /** Reverse commission for a refunded transaction. */
  reverse(input: CommissionAccrualInput): Promise<void>
}
