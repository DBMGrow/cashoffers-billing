# Capability: Free Trials

Billing runs two unrelated trials. They share the word "trial" and nothing else: different products, different statuses, different emails, different cron blocks.

| | Card-on-file trial (Desk #1350) | HomeUptick trial (legacy) |
| --- | --- | --- |
| Who gets it | A **new** signup on a product whose `data.trial.enabled` is true | A CashOffers user created with no live subscription |
| Card | Required, saved at signup | None |
| Status during the trial | `active` | `trial` |
| `amount` | The product's renewal cost | 0 |
| Marker | `Subscriptions.data.trial` | `status = 'trial'` |
| At the end | The ordinary renewal cron charges the card | The cron cancels it |
| Emails | `trial-welcome`, `trial-ending` (7 days before) | `trial-expiring` (10 days before), `trial-expired` |

Plan: [InstantOffers365 30-day trial](https://github.com/DBMGrow/cashoffers-dashboard-mono/blob/staging/docs/plans/1350-instantoffers365-30-day-trial-plan.md) (feature #1139 in cashoffers-dashboard-mono). The review defects D1 to D6 are `docs/plans/feedback/2026-10-14-1139-trial-review-defects.md` in the same repo.

---

## Card-on-file trial

### Business outcome

An agent signs up, saves a card, pays nothing today, and is charged the plan's normal price when the trial ends. The trial is a deferred first charge, not a separate kind of subscription: from day one the subscription is `active` at full price, and the renewal path does not know trials exist.

### How a product turns it on

A product offers the trial when its `Products.data` carries:

```json
"trial": { "enabled": true, "duration_days": 30, "require_card": true }
```

- **Where it is set:** the dashboard's product form (cashoffers-dashboard-mono, `whitelabels/[id]/products/[productId]/ProductForm.tsx`) has a Free trial block: a checkbox and a day count (default 30). The block renders only while the `product_free_trial` flag is on for the admin. With the flag off the block is absent and a save passes an existing `data.trial` through unchanged.
- **Validation:** api-v2 refuses a malformed block on product POST and PUT (`productTrialSchema` in `@g8r/schemas`: `duration_days` a whole number from 1 to 90, `require_card` exactly `true`). The form clamps the day count to that range.
- **Renewal cost 0:** the form disables the checkbox and saves no trial. A trial defers a charge, and a free product has none to defer.
- **The billing gate is the product row.** Billing has no flag system, so `data.trial.enabled` on the product is the only switch, and editing it off is the kill switch. A product with no `trial` block behaves exactly as before. `ProductTrial` in `api/domain/types/product-data.types.ts` mirrors the shared schema.

### What the agent pays, and when

1. **At signup: nothing.** `calculatePricing` (`purchase-helpers.ts`) returns `initialAmount: 0` and `trialDays: N` for a new user on a trial product. The new-user purchase saves the card and creates no payment transaction and no `PaymentProcessed` event. The signup fee is not charged, then or later. A coupon is ignored with a `warn` line (the signup page hides the promo field).
2. **The subscription** is created `active`, `amount` = the renewal cost, `renewal_date` = now + exactly N days (not a calendar month), and `data.trial = { ends_at, duration_days }`, where `ends_at` is the same instant as `renewal_date` in ISO form.
3. **The first charge** is the renewal cost, taken by the ordinary renewal cron: the first hourly run (`0 * * * *` in cashoffers-cron) at or after `renewal_date`. The day the agent is told is that run's **UTC** calendar day, so a trial ending at 23:30 UTC is charged, and named, on the next day. Later renewals follow the product's billing period from there.
4. **If the first charge fails,** the normal [payment retry rules](../rules/payment-retry-rules) apply. Nothing trial-specific happens.

A card record with no `card_id` fails the purchase with `TRIAL_CARD_REQUIRED` before the subscription exists. An **existing account** enrolling through `/manage` never gets the trial and pays list price today.

The signup page states the terms before the agent presses Sign Up: the pricing card reads "N-day free trial", the card step adds "You won't be charged until your N-day trial ends.", and the review step reads "Due today $0" then "$<renewal cost>/mo starting <date>". Details: [Purchase Flow, Free Trials](../../system/data-flows/purchase-flow).

### Emails

- **`trial-welcome`** replaces the $0 receipt when `SubscriptionCreated` carries a trial (from the event's `subscriptionTrial` metadata, else the row's `data.trial`). It names the trial length, the first-charge date and the amount.
- **`trial-ending`** goes out once, 7 days before `data.trial.ends_at`, from the subscriptions cron (`findTrialsEndingWithin(7)`). It names the date, the amount (`Subscriptions.amount`) and the newest saved card. `data.trial.reminder_sent_at` is stamped only after the send succeeds, so a failed send retries on the next run. A cancelled, cancel-on-renewal or paused trial gets no reminder.
- Both emails are marked `[SANDBOX]` when the subscription's `square_environment` is `sandbox`.

See [Email Notifications](email-notifications).

### Cancelling during the trial

Cancelling sets `cancel_on_renewal` (`cancel-on-renewal.use-case.ts`). On the trial's end date the renewal use case cancels the subscription with no charge and publishes `SubscriptionCancelled`, which applies the white label's suspension strategy. A cancel-on-renewal trial gets no reminder and is excluded from the health anomalies.

### Rules from the review defects (D1 to D6)

- **`ends_at` follows `renewal_date` until the trial converts (D1).** A trial has converted once it has a completed `RENEWAL` purchase request with `amount_charged > 0`. Until then, `SubscriptionRepository.update`, which every billing writer of `renewal_date` goes through (the CashOffers webhook's reactivation, the resume route, the dev `set-state` tool), rewrites `data.trial.ends_at` to the new `renewal_date` with `JSON_SET` in the same statement. The renewal that converts the trial is excluded (its request is in `CREATING_SUBSCRIPTION` or `FINALIZING` when it writes the next period), so after conversion `ends_at` keeps the first-charge date as history.
- **Moving the date clears the reminder stamp (D6).** When that rewrite moves `ends_at` by more than a second, it also removes `reminder_sent_at`, so the agent is reminded again 7 days before the new date. A write of the same date keeps the stamp.
- **A paused trial is never an anomaly and gets no reminder (D6).** A deactivated CashOffers account pauses the subscription (`status = 'paused'`); the cron never charges or reminds a paused row, and the reconciliation does not report it. Reactivation sets `renewal_date` to one month after the day the account comes back (Desk #1644), so the trial's end moves there with it and the normal rules resume.
- **A plan change keeps the trial (D5).** `POST /manage/purchase` replaces `Subscriptions.data` with the new product's data. When the row has an unconverted trial and the new document has no `trial`, the same statement copies the stored `data.trial` into it (`withTrialRules` in `subscription.repository.ts`, also used by `scripts/reconcile-subscriptions.ts --commit`). A converted or non-trial subscription gets the new product's data exactly as sent.
- **A trial subscription stores its card's Square environment (D2).** With no payment at signup, `square_environment` is taken from the saved card (the payment's environment when there is one, else the card's, else NULL for a free product). The renewal still chooses its environment from the card.
- **One UTC first-charge date (D3).** `api/domain/services/trial-charge-date.ts` holds the rule: `trialFirstChargeDate(N)` is now plus exactly N days, and `formatTrialChargeDate` names the UTC day of the first hourly run at or after it. The signup review step, `trial-welcome` and `trial-ending` (body and subject) all use it, so the page and both emails name the same day whatever zone the browser or server runs in. If the renewal cron's schedule changes, `RENEWAL_RUN_INTERVAL_MS` must change with it.

### Health signals

The subscriptions cron logs each anomaly at `error` (with `subscription_id`, `user_id`, `product_id`), and the [daily health report](../../system/components/health-report)'s Free Trials section counts the first two. Either count above 0 turns the report to Warning.

| Signal | Query | Meaning |
| --- | --- | --- |
| `trials_without_card` | `findTrialsWithoutCard` | An active trial before its end, not cancel-on-renewal, whose user has no saved card. Its first charge will fail. |
| `unreconciled_ended_trials` | `findEndedTrialsUnreconciled` | An `active` trial whose `ends_at` and `renewal_date` both passed more than 24 hours ago, not cancel-on-renewal, no payment failure, and no completed paid `RENEWAL`. The cron should have charged it and did nothing visible. Paused, cancelled, inactive and suspended trials are never counted. |
| "Trial date drift" (cron error only) | `findUnconvertedTrials` + `trialDateDrift` | An unconverted, non-cancelled trial whose `ends_at` and `renewal_date` differ by more than a second: a writer outside billing (direct SQL, the legacy API) moved one without the other. Logged as "Trial date drift: subscription N has ends_at X but renewal_date Y"; never corrected automatically. It reaches the health report through its error count and list. |

The report also shows `active_trials` and `ending_in_7d`. Billing's mysql2 pool sets no time zone: production runs in UTC, but a script run against the database from a machine in another zone writes shifted `DATETIME`s, and the drift check will flag the trials it touched.

### Dashboard surfaces (cashoffers-dashboard-mono)

The agent's trial banner (end date, amount, link to billing) shows behind `product_free_trial` and disappears once `ends_at` passes. The billing table labels a row "Trial" when it is an `active` row with a live `data.trial`, or a HomeUptick `trial` row; that label is not behind the flag. Both read the trial through `activeTrial` in `@g8r/schemas`.

### Known gaps

- A plan change during a trial is charged the prorated difference between the plans, although the agent has paid nothing yet. Open product question.
- Trial-to-paid conversion sends the ordinary renewal receipt; there is no conversion-specific email.

### Key files

- `api/use-cases/subscription/purchase-helpers.ts` (`calculatePricing`, `createSubscriptionRecord`, `calculateRenewalDate`)
- `api/use-cases/subscription/purchase-new-user.use-case.ts`
- `api/infrastructure/database/repositories/subscription.repository.ts` (`withTrialRules` and the trial queries)
- `api/domain/services/subscription-trial.ts`, `api/domain/services/trial-charge-date.ts`
- `api/cron/subscriptionsCron.ts` (reminder and invariant blocks)
- `api/infrastructure/email/templates/trial-welcome.email.tsx`, `trial-ending.email.tsx`
- Tests: `purchase-trial.use-case.test.ts`, `subscription.repository.trial*.test.ts`, `plan-change.trial.test.ts`, `set-state.trial-end.test.ts`, `trial-charge-date.test.ts`, `api/tests/integration/trial-end-follows-renewal.test.ts`

---

## HomeUptick trial (legacy)

### Business outcome

A user created in CashOffers with no live subscription gets a no-card HomeUptick trial. When it ends, it is cancelled; nothing converts to paid.

### What happens

1. **Start:** the CashOffers webhook's `user.created` handler (`cashoffers-webhook.handler.ts`), when the user has no `active`, `trial`, `paused` or `suspended` subscription, creates a subscription named "Free Trial" with `status = 'trial'`, `amount = 0`, and `renewal_date` = now + `homeuptick.free_trial.duration_days` of the free trial product (90 by default), then publishes `SubscriptionCreated` with the product data so CashOffers and HomeUptick are provisioned. (`CreateFreeTrialUseCase` implements the same thing but nothing calls it.)
2. **Warning:** the subscriptions cron's `findTrialsExpiringSoon(10)` sends `trial-expiring` to every `trial` subscription ending within 10 days.
3. **Expiry:** `findExpiredTrials(now)` finds `trial` subscriptions whose `renewal_date` has passed; each is set to `cancelled`, `SubscriptionCancelled` is published with reason `trial_expired`, and `trial-expired` is sent.

The product's `homeuptick.free_trial` block also seeds `Homeuptick_Subscriptions` (`free_trial_contacts`, `free_trial_days`, `free_trial_ends`) on any purchase; that is a contact allowance, not a billing trial. See [Purchase Flow, HomeUptick Subscription Seeding](../../system/data-flows/purchase-flow).

### Known gaps

- `trial-expiring` has no sent stamp, so it goes out on every cron run during the last 10 days.
- A reactivated account whose HomeUptick trial was cancelled at expiry is resumed `active` one month out (the webhook resumes `cancelled` rows), at its `amount` of 0.

---

## Related

- [Subscription Rules](../rules/subscription-rules)
- [Payment Retry Rules](../rules/payment-retry-rules)
- [Subscription Cron](../../system/components/subscription-cron)
- [Scenario: Trial Expiration](../../development/scenarios/trial-expiration) (describes an older design with a `free_trial` status; out of date)
