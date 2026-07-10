# CO-I130 — Billing v1→v2 API Repoint (status)

**PR:** [#30](https://github.com/DBMGrow/cashoffers-billing/pull/30) (draft) · `refactor/CO-I130-billing-v1-to-v2-repoint` → `staging`
**Last updated:** 2026-07-09 by Gab
**Parent effort:** CashOffers v1 decommission (CO-I130). The team-wide rollup lives in the monorepo — [`docs/plans/v2-migration-status-board.md`](https://github.com/DBMGrow/cashoffers-dashboard-mono/blob/staging/docs/plans/v2-migration-status-board.md) (§4, "Real-user /api/v1 tail" row) — this file only tracks the billing side. Full Q&A rationale: monorepo [`docs/questions/CO-I130-billing-v1-repoint-questions.md`](https://github.com/DBMGrow/cashoffers-dashboard-mono/blob/staging/docs/questions/CO-I130-billing-v1-repoint-questions.md).

## Why (one paragraph)

Billing's user/team/property calls still hit the **v1** API (`API_URL`); prod logs identified billing's service identity (user id 2) in the v1 traffic tail. v1 is being retired, and — sooner — monorepo PR #669 deletes the internal bridge those v1 calls depend on, which would **silently break premium activation**. This PR moves all six remaining call sites to v2 (`API_URL_V2`, already present in every env — zero env changes).

## Status checklist

- [x] Six v1 call sites identified (user-api client ×5 ops, auth login, signup slug check, manage/checktoken, unlock-property ×2) — 2026-07-09
- [x] Fix implemented incl. 3 v1↔v2 contract adaptations (no `?email=` filter on v2 → search+exact-match; taken slug = 400; `_api_token` not exposed → DB lookup) — 2026-07-09
- [x] `tsc` clean · 14/14 tests pass — 2026-07-09
- [x] **Live A/B/A verified locally** — with fix, requests observed landing on local api-v2; with old code, zero local hits (went remote) — 2026-07-09
- [x] Draft PR #30 opened → `staging` — 2026-07-09
- [ ] Team review → mark ready → merge
- [ ] Deploy billing (staging first: run a signup, an SSO link if any exist, a premium toggle)
- [ ] **Prod verification:** user-2 traffic disappears from v1 logs / `INTERNAL_API` count (key holder query, monorepo tracker §6)
- [ ] Later cleanup (separate PR): remove `API_URL` from required env vars once nothing references it

## Ordering constraint

⚠️ **Merge + deploy this PR before monorepo PR #669 is promoted to `main`.** #669 removes the v1→v2 bridge receivers; billing's current v1 calls transit that bridge, and v1 does not check the bridge response — failures would be silent (customer pays, premium never applies).

## Endpoint usage notes (verified 2026-07-09)

| Call | Live? |
|---|---|
| `updateUser` / `getUser` | **Core traffic** — premium lifecycle (account + webhook + purchase handlers) |
| signup slug check | Live — signup flow slug step |
| `getUserByEmail` | Dead code (no production callers); fixed defensively |
| `manage/checktoken` | Dormant — no link generator exists anymore; serves old links only |
