/**
 * Billing Visibility Service
 *
 * Pure predicates for Third-Party Billing Phase 0: corporate pays for some
 * agents' and broker owners' subscriptions, so those users get no self-service
 * billing surface. The dashboard hides their Billing tab (dashboard-mono
 * `computeHideBilling`, docs/plans/hide-billing-tab-phase-0-plan.md there);
 * this service mirrors the same data-driven rule so charge-confirmation
 * emails (purchase receipt, renewal receipt) are suppressed for the same
 * users — the charged card isn't theirs, and a "your subscription has been
 * charged" email makes them think it might be.
 *
 * The rule, mirrored from the dashboard:
 *  - the subscription's product opts in via `Products.data.hides_billing = true`
 *    (set from the product admin screen — a business decision, not a code change)
 *  - AND the user's account was created on/after the grandfather cutoff.
 *    Accounts that predate the cutoff keep their Billing tab regardless of
 *    product reassignment, so they keep their emails too.
 *
 * The flag is per-product, not per-user: there is no `hides_billing` column
 * on `Users` in either repo (verified 2026-09-18).
 *
 * Not mirrored: the dashboard's `hide_billing_for_corporate_products` rollout
 * flag. That flag lives in dashboard-mono's flags module (per-tier rollout
 * guard, slated for removal once stable); the durable rule is the product data
 * plus the cutoff, and that is what this service keys on.
 *
 * Fail open: when product data or the user's creation date can't be resolved,
 * callers should send the email — a possibly-redundant receipt is safer than
 * silently dropping a legitimate one (same convention as the
 * integration-managed suppression in EmailNotificationHandler).
 */

import type { ProductData } from "@api/domain/types/product-data.types"

/**
 * Accounts created before this instant are grandfathered: they keep the
 * Billing tab (and their billing emails) even on a `hides_billing` product.
 * Must match `PHASE_0_BILLING_GRANDFATHER_CUTOFF` in dashboard-mono's
 * billing_visibility module.
 */
export const BILLING_GRANDFATHER_CUTOFF = new Date("2026-08-01T00:00:00Z")

/**
 * `Products.data` isn't reliably an object — depending on the query path it
 * can come back as a JSON string. Mirrors the dashboard's parseProductData so
 * a stringified `hides_billing` doesn't silently read as absent.
 */
export function parseProductData(data: unknown): ProductData | null {
  if (!data) return null
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data)
      return parsed && typeof parsed === "object" ? (parsed as ProductData) : null
    } catch {
      return null
    }
  }
  return typeof data === "object" ? (data as ProductData) : null
}

/**
 * Returns true when the product is flagged as corporate-billed
 * (`data.hides_billing === true`). Products without the flag are treated as
 * normal self-service billing (backward compatible).
 */
export function productHidesBilling(data: ProductData | null | undefined): boolean {
  return data?.hides_billing === true
}

/**
 * Whether charge-confirmation emails should be suppressed for this
 * user/product pair. True only when the product hides billing AND the user is
 * not grandfathered. An unknown or unparseable creation date returns false
 * (fail open — send the email).
 */
export function shouldSuppressChargeEmails(
  data: ProductData | null | undefined,
  userCreatedAt: Date | string | null | undefined
): boolean {
  if (!productHidesBilling(data)) return false
  if (!userCreatedAt) return false
  const createdAt = userCreatedAt instanceof Date ? userCreatedAt : new Date(userCreatedAt)
  if (isNaN(createdAt.getTime())) return false
  return createdAt >= BILLING_GRANDFATHER_CUTOFF
}
