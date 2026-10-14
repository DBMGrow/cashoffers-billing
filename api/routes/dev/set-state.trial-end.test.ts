/**
 * D1 (Desk #1350), AC20 for the dev `POST /subscription/:id/set-state` route: the staging tool that
 * moves a trial's renewal_date (AC17 used it) moves `data.trial.ends_at` in the same statement,
 * because the route writes through `SubscriptionRepository.update`.
 */

import { describe, it, expect, vi } from "vitest"

const harness = vi.hoisted(() => ({ queries: [] as any[], repository: undefined as any }))

vi.mock("@api/lib/repositories", async () => {
  const { capturingKysely } = await import("@api/tests/helpers/capturing-kysely")
  const { SubscriptionRepository } = await import("@api/infrastructure/database/repositories/subscription.repository")
  const { db, queries } = capturingKysely((q) =>
    q.sql.includes("from `Subscriptions`")
      ? [
          {
            subscription_id: 276,
            user_id: 999843,
            amount: 25000,
            status: "active",
            suspension_date: null,
            renewal_date: new Date("2026-10-30T12:00:00.000Z"),
            data: JSON.stringify({ trial: { ends_at: "2026-10-30T12:00:00.000Z", duration_days: 30 } }),
          },
        ]
      : []
  )
  harness.queries = queries
  harness.repository = new SubscriptionRepository(db)
  return { subscriptionRepository: harness.repository, productRepository: {}, transactionRepository: {} }
})
vi.mock("@api/lib/database", () => ({ db: {} }))
vi.mock("@api/lib/services", () => ({ logger: {}, userApiClient: {}, eventBus: {}, paymentProvider: {} }))
vi.mock("@api/use-cases/subscription", () => ({ renewSubscriptionUseCase: {} }))
vi.mock("@api/config/config.service", () => ({ config: { nodeEnv: "test" } }))

import { devRoutes } from "./routes"
import { subscriptionUpdates, trialEndsAtWritten } from "@api/tests/helpers/capturing-kysely"

describe("dev set-state (D1, AC20)", () => {
  it("a renewal_date set through set-state moves data.trial.ends_at in the same update", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    const res = await devRoutes.request("/subscription/276/set-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renewal_date: "2026-11-04T12:00:00.000Z" }),
    })

    expect(res.status).toBe(200)
    const updates = subscriptionUpdates(harness.queries)
    expect(updates).toHaveLength(1)
    expect(updates[0].sql).toContain("`renewal_date` = ?")
    expect(trialEndsAtWritten(updates[0])).toBe("2026-11-04T12:00:00.000Z")
  })

  it("a set-state that does not touch renewal_date leaves data alone", async () => {
    harness.queries.length = 0
    const res = await devRoutes.request("/subscription/276/set-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_failure_count: 1 }),
    })

    expect(res.status).toBe(200)
    const [update] = subscriptionUpdates(harness.queries)
    expect(update.sql).not.toContain("JSON_SET")
  })
})
