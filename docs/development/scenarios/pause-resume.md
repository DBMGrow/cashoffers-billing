# Scenario: Pause and Resume

## Goal
A user or admin pauses a subscription temporarily. The subscription is later resumed and billing continues.

## Preconditions
- Subscription is active

## Pause Steps
1. User or admin calls `POST /api/subscription/:id/pause`
2. Status changes to `paused`, `paused_at` recorded
3. Cron skips this subscription on future runs

## Resume Steps
1. User or admin calls `POST /api/subscription/:id/resume`
2. Status changes back to `active`
3. `next_renewal_at` recalculated from resume date

## Expected Result (pause)
- No charges while paused

## Expected Result (resume)
- Billing resumes from resume date

## Linked Rules
- [Subscription Rules](../../business/rules/subscription-rules)

## Integration Test
- Status: yes
- File: `api/tests/integration/pause-resume.test.ts`

## Dev CLI Support
- Status: no
