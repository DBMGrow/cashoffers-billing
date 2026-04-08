# Billing Scenario Matrix

Exhaustive list of every CashOffers / HomeUptick billing scenario the system must support. One subscription manages both services, with the `managed` flag and HU data section determining behavior per service.

## Key Principles

- **CO premium always includes HU base access** (500 contacts, no separate charge). HU tiers above base are automatic based on contact count.
- **HU pricing is usage-based**, calculated at charge time from the HU API.
- **CO and HU are always charged together** on the same subscription. If HU API is unavailable at renewal, do not charge CO either — retry the whole thing.
- **`managed` flag** determines what billing touches on suspension/failure. `managed=true` → billing controls CO access. `managed=false` → CO is external, billing only manages HU.
- **SHELL role** = zero-feature CO access. Users keep SHELL on subscription end/suspension. It exists solely to allow HU login (HU auth depends entirely on CO).
- **Paused vs Suspended**: Paused = admin deactivated CO account (webhook-driven). Suspended = max payment retries exhausted. Different resume behaviors.
- **Non-user-fault failures** (HU API down, Square outage) do NOT increment `payment_failure_count`.
- **No remove card** — only replace.
- **Each user manages their own HU billing**, even team members.

## Product Types

| ID | Product | `product_category` | CO managed | CO access | HU access | Billing |
|---|---|---|---|---|---|---|
| **P-CO** | CO Premium | `premium_cashoffers` | true | Premium (is_premium=1) | Base 500 included; usage-based tiers auto-applied by contact count | CO base + HU usage combined charge |
| **P-HU** | HU Paid (standalone) | `external_cashoffers` | false | External (not managed) | Usage-based paid | HU only |
| **P-TRIAL** | HU Free Trial | `homeuptick_only` | true | SHELL | Trial (card required, auto-converts to paid at trial end) | Nothing during trial; HU billing starts at conversion |

### Product Notes

- **`premium_cashoffers`** covers all CO premium subscriptions. HU tiers are not a separate product — they're automatic based on contact count and calculated at charge time.
- **`external_cashoffers`** is for users whose CO is managed externally (KW Offerings agents, team members). `managed=false` ensures billing never touches their CO account. Purchased via manage flow (`/purchase/existing`), NOT the main signup page.
- **`homeuptick_only`** is a billing-managed HU subscription with SHELL CO access. May include a free trial (WIP — not in initial release). Requires card upfront. Auto-converts to paid HU at trial end.

## HU Data States

HU state lives in the subscription's HU data section, not the subscription status field.

| State | Description |
|---|---|
| **None** | No HU data (should not occur — all products have HU component) |
| **Base** | 500 contacts via CO premium; usage-based charge applied if >500 contacts |
| **Trial-Active** | P-TRIAL: card on file, auto-converts at `trial_ends_at` |
| **Trial-Paused** | Trial suspended due to CO deactivation; `trial_ends_at` extended on resume |
| **Paid-Active** | Usage-based billing active |
| **Paid-Suspended** | HU access revoked due to subscription suspension |

## Non-Billing HU State

| State | Description |
|---|---|
| **Auto-Trial** | Existing HU feature: auto-activated on first HU sign-in for free users. No subscription record, no card, no billing involvement. Access turned off at expiry. Cleared if user purchases P-CO or P-TRIAL. |

## State Combination Matrix

| # | Product | Subscription Status | HU Data State | CO State | What billing manages |
|---|---|---|---|---|---|
| 1 | P-CO | Active | Base (or usage-based if >500 contacts) | Premium | CO charge + HU usage charge combined |
| 2 | P-CO | In retry (payment failed, user-fault) | Same as active until max retries | Premium (until suspension) | Retry ladder; both CO + HU suspended on max |
| 3 | P-CO | Suspended (max retries) | Paid-Suspended | Per whitelabel: SHELL or is_premium=0 | Nothing until card update triggers successful payment |
| 4 | P-CO | Paused (CO deactivated) | Paused | Deactivated | Nothing; no retries; resume on `user.activated` webhook |
| 5 | P-CO | cancel_on_renewal | Active until period end | Premium until period end | Cancel at renewal; CO per whitelabel; HU access off; SHELL preserved |
| 6 | P-HU | Active | Paid-Active | External (untouched) | HU charge only |
| 7 | P-HU | In retry | Same as active until max retries | External (untouched) | Retry ladder; only HU suspended on max |
| 8 | P-HU | Suspended | Paid-Suspended | External (untouched) | HU access off; CO unaffected |
| 9 | P-HU | Paused (CO deactivated) | Paused | External (deactivated) | Nothing; resume on `user.activated` |
| 10 | P-HU | cancel_on_renewal | Active until period end | External (untouched) | Cancel at renewal; HU access off; CO unaffected |
| 11 | P-TRIAL | Active | Trial-Active | SHELL | No charge; monitors `trial_ends_at` |
| 12 | P-TRIAL | Conversion at trial end | Trial-Active → Paid-Active | SHELL | Charge card; start HU billing; transition to P-HU equivalent |
| 13 | P-TRIAL | Paused (CO deactivated) | Trial-Paused | SHELL (deactivated) | No charge; `trial_ends_at` extended by pause duration on resume |
| 14 | P-TRIAL | cancel_on_renewal | Trial-Active | SHELL | Cancel at trial end instead of converting; HU access off; SHELL preserved |
| 15 | None | N/A | Auto-Trial (HU-driven) | Free / any | Billing not involved; billing pauses auto-trial on CO deactivation |

## Lifecycle Events

### Purchase / Enrollment

| # | Event | Behavior |
|---|---|---|
| P1 | New user purchases P-CO | Create subscription; CO premium; HU base 500 included. If user had HU auto-trial → **clear it** (CO premium supersedes). If user had P-TRIAL → **end trial, upgrade** |
| P2 | New user purchases P-HU | Create subscription (managed=false); CO untouched; HU paid starts |
| P3 | New user starts P-TRIAL | Require card; create subscription; CO SHELL; HU trial starts with `trial_ends_at`. If user had auto-trial → **clear it** (P-TRIAL replaces) |
| P4 | P-TRIAL user purchases P-CO | **End trial early**; upgrade to P-CO; CO → premium; HU base included (better than trial access); charge CO amount |
| P5 | HU auto-trial user purchases P-CO | **Clear auto-trial**; create P-CO subscription; CO premium; HU base 500 |
| P6 | HU auto-trial user starts P-TRIAL | **Clear auto-trial**; P-TRIAL takes over as billing-managed trial |
| P7 | KW/team member purchases P-HU | managed=false; CO external; HU billing starts |
| P8 | HU tier changes (user gains/loses contacts) | No purchase event; automatically reflected in next renewal charge calculation |

### Renewal

| # | Event | Behavior |
|---|---|---|
| R1 | P-CO renews | Fetch HU contact count from HU API; calculate usage-based HU charge; combined charge (CO base + HU usage) |
| R2 | P-HU renews | Fetch HU contact count; calculate usage-based charge; single HU payment |
| R3 | P-TRIAL reaches `trial_ends_at` | Auto-convert: charge card for HU usage-based amount; HU data → Paid-Active; subscription continues as P-HU equivalent |
| R4 | P-TRIAL conversion payment fails | Enter retry ladder (user-fault failures only); HU access revoked at `trial_ends_at`; retry continues for payment. On success, HU access restored. On max retries, suspend |
| R5 | HU API unavailable at renewal | **Do not charge.** Do not increment `payment_failure_count`. Schedule retry without penalty |
| R6 | Any non-user-fault failure | Same as R5 — no failure count increment; retry at same interval position |

### Payment Failure & Retry

| # | Event | Behavior |
|---|---|---|
| F1 | User-fault failure (card declined, insufficient funds) | Increment `payment_failure_count`; retry ladder: 1d → 3d → 7d → suspend |
| F2 | System-fault failure (HU API down, Square outage) | **Do not increment** `payment_failure_count`; schedule retry at same interval |
| F3 | Max retries → suspend P-CO | CO: per whitelabel (`DEACTIVATE_USER` → role=SHELL; `DOWNGRADE_TO_FREE` → is_premium=0 keep role); HU access off |
| F4 | Max retries → suspend P-HU | HU access off; CO untouched (managed=false); user keeps whatever CO access they had |
| F5 | Card updated during retry window | Next scheduled retry uses new card |
| F6 | Subscription paused (CO deactivation) during retry window | **Pause stops retries.** No further attempts until resumed. Retry resumes from same position |
| F7 | Card update on suspended subscription | Trigger immediate payment attempt; on success → reactivate subscription, restore access |
| F8 | Card update on paused subscription | Store new card only; subscription stays paused (paused = admin decision, not billing) |

### Card Management

| # | Event | Behavior |
|---|---|---|
| C1 | Card replaced on active subscription | New card used at next renewal |
| C2 | Card replaced during retry window | Next retry uses new card |
| C3 | Card replaced on suspended subscription | Trigger immediate payment; on success → reactivate |
| C4 | Card replaced on paused subscription | Store new card; no state change |
| C5 | Card provided at P-TRIAL enrollment | Required; stored for auto-conversion charge at trial end |

### Cancellation

| # | Event | Behavior |
|---|---|---|
| X1 | cancel_on_renewal on P-CO | At period end: CO per whitelabel behavior; HU access off; SHELL preserved |
| X2 | cancel_on_renewal on P-HU | At period end: HU access off; CO untouched (external) |
| X3 | cancel_on_renewal on P-TRIAL | At trial end: do not convert; HU access off; SHELL preserved |
| X4 | Immediate cancellation (admin) | Same effects as above but immediate |

### Downgrade

| # | Event | Behavior |
|---|---|---|
| D1 | P-CO → free (downgrade_on_renewal) | At renewal: CO is_premium=0; HU base 500 removed (was included with CO premium); HU access off |

### Pause / Resume

| # | Event | Behavior |
|---|---|---|
| PZ1 | Pause P-CO (CO deactivated via webhook) | CO deactivated; HU access frozen; no charges; no retries |
| PZ2 | Pause P-HU (CO deactivated via webhook) | HU access frozen; CO was external (now deactivated); no charges; no retries |
| PZ3 | Pause P-TRIAL (CO deactivated via webhook) | Trial paused; `trial_ends_at` extended by pause duration on resume |
| PZ4 | Resume any (CO reactivated via webhook) | `next_renewal_at` recalculated (today + remaining period); for P-TRIAL, `trial_ends_at` extended; if was in retry window, retries resume |

### Webhook Events (from CashOffers)

| # | Event | Behavior |
|---|---|---|
| W1 | `user.deactivated` — has active subscription | **Pause subscription** regardless of `managed` flag; if P-TRIAL → trial paused |
| W2 | `user.deactivated` — has HU auto-trial (no subscription) | Tell HU API to pause auto-trial |
| W3 | `user.deactivated` — in retry window | **Pause subscription → stops retries**; retry resumes from same position on reactivation |
| W4 | `user.activated` — has paused subscription | **Resume subscription**; recalculate dates; if P-TRIAL → extend `trial_ends_at` |
| W5 | `user.activated` — had paused auto-trial | Tell HU API to resume auto-trial |
| W6 | `user.deactivated` — no subscription, no auto-trial | Nothing to do; log and ignore |

## Edge Cases

| # | Scenario | Resolution |
|---|---|---|
| E1 | P-TRIAL conversion fails — when is HU access revoked? | HU access revoked at `trial_ends_at` (trial benefit ends). Retry ladder continues for payment only. On eventual success, HU access restored. On max retries, suspended |
| E2 | P-CO user exceeds 500 HU contacts then downgrades to free | At renewal: CO → free; HU access off entirely (no CO premium = no base access, no paid HU) |
| E3 | P-HU user's external CO team membership ends | CO deactivated externally → `user.deactivated` webhook → billing pauses P-HU. On `user.activated` → resume. If CO never restored, user must switch to a plan that includes CO (P-CO) or remain paused |
| E4 | User has HU auto-trial AND starts P-TRIAL | Clear auto-trial; P-TRIAL takes over |
| E5 | User on P-TRIAL purchases P-CO before trial ends | End trial; upgrade to P-CO; CO premium + HU base; trial was superseded |
| E6 | Suspended user updates card | Trigger immediate payment; on success → reactivate. On failure → remains suspended, counts as another retry |
| E7 | Paused user updates card | Store card only; stay paused. Paused = admin action, not billing |
| E8 | P-HU user — CO deactivated, subscription paused, CO reactivated, but external team no longer exists | Subscription resumes on `user.activated`. If team truly gone and CO deactivated again → another pause. User would need to switch to P-CO for self-managed CO access |
| E9 | HU API down for extended period | For now: retries continue without `payment_failure_count` increment. Future: admin override flag to skip HU in billing entirely |
| E10 | `user.deactivated` webhook for user billing has no record of | Log and ignore (no subscription to pause) |
| E11 | P-CO renewal email needs to show HU was free via trial vs paid | Renewal emails must indicate: HU base included (CO premium users), HU usage-based charge amount, or "HU trial — converting at [date]" |

## Free Trial Comparison

| Aspect | HU Auto-Trial (existing) | P-TRIAL (billing-managed) |
|---|---|---|
| Triggered by | First HU sign-in | Explicit product purchase |
| Card required | No | Yes |
| Subscription record | None (Homeuptick_Subscriptions only) | Yes, in billing system |
| Auto-converts to paid | No, access simply turned off | Yes, charges card at `trial_ends_at` |
| Billing involvement | None (except pause on CO deactivation) | Full lifecycle management |
| Cleared when | User purchases P-CO or P-TRIAL | User purchases P-CO (superseded) |
| CO access during trial | Whatever they already have | SHELL (created at enrollment) |

## Suspension Behavior by Product and Whitelabel

| Product | Whitelabel: DEACTIVATE_USER | Whitelabel: DOWNGRADE_TO_FREE |
|---|---|---|
| P-CO | CO role → SHELL; HU access off | CO is_premium=0, role unchanged; HU access off |
| P-HU | CO untouched; HU access off | CO untouched; HU access off |
| P-TRIAL | N/A (no payment to fail during trial) | N/A |

Note: In both whitelabel cases, SHELL access is always preserved — user keeps portal login.
