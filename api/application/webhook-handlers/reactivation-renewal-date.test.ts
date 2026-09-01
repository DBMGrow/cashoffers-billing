/**
 * Desk #1644 — "Billing suspension needs to update the renewal date to be the date their
 * account is reactivated +1 month" (David Crammer, 27 Aug 2026).
 *
 * Replaces the previous rule, which carried over the days remaining at suspension and clamped a
 * past date to now. That produced an immediate charge for long-suspended subscriptions: staging
 * subscription 83 was 151 days overdue and resumed with renewal = the same day.
 */

import { describe, it, expect } from 'vitest'
import { addOneMonth } from './cashoffers-webhook.handler'

describe('addOneMonth', () => {
  it('advances by one calendar month', () => {
    expect(addOneMonth(new Date('2026-08-29T10:00:00Z')).toISOString()).toBe(
      new Date('2026-09-29T10:00:00Z').toISOString()
    )
  })

  it('preserves the time of day, so the renewal lands in the same billing window', () => {
    const result = addOneMonth(new Date('2026-08-29T13:45:31Z'))
    expect(result.getUTCHours()).toBe(13)
    expect(result.getUTCMinutes()).toBe(45)
    expect(result.getUTCSeconds()).toBe(31)
  })

  // Plain setMonth(getMonth() + 1) overflows: 31 Jan + 1 month = 3 Mar, not 28 Feb. Left
  // unhandled that silently grants two or three free days on every month-end reactivation.
  it('clamps to the last day when the target month is shorter', () => {
    expect(addOneMonth(new Date('2026-01-31T00:00:00Z')).getUTCDate()).toBe(28)
    expect(addOneMonth(new Date('2026-01-31T00:00:00Z')).getUTCMonth()).toBe(1) // February
  })

  it('clamps to 29 February in a leap year', () => {
    expect(addOneMonth(new Date('2028-01-31T00:00:00Z')).getUTCDate()).toBe(29)
  })

  it('clamps 31 March to 30 April', () => {
    const result = addOneMonth(new Date('2026-03-31T00:00:00Z'))
    expect(result.getUTCMonth()).toBe(3) // April
    expect(result.getUTCDate()).toBe(30)
  })

  it('rolls the year over from December', () => {
    const result = addOneMonth(new Date('2026-12-15T00:00:00Z'))
    expect(result.getUTCFullYear()).toBe(2027)
    expect(result.getUTCMonth()).toBe(0) // January
  })

  it('always returns a future date, however stale the subscription', () => {
    // The old clamp existed to stop a long-dead subscription being charged immediately and then
    // repeatedly to "catch up". Deriving from `now` rather than the stored renewal_date removes
    // that failure mode by construction.
    const now = new Date()
    expect(addOneMonth(now).getTime()).toBeGreaterThan(now.getTime())
  })

  it('does not mutate its argument', () => {
    const input = new Date('2026-08-29T00:00:00Z')
    const snapshot = input.getTime()
    addOneMonth(input)
    expect(input.getTime()).toBe(snapshot)
  })
})
