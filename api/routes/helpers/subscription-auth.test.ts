import { describe, it, expect, beforeEach, vi } from "vitest"
import { Hono } from "hono"

vi.mock("@api/lib/repositories", () => ({
  subscriptionRepository: { findById: vi.fn() },
}))

import { subscriptionRepository } from "@api/lib/repositories"
import { checkSubscriptionAuthorization } from "./subscription-auth"

const mockFindById = vi.mocked(subscriptionRepository.findById)

const VICTIM_ID = 5
const ATTACKER_ID = 2
const victimSubscription = { subscription_id: 99, user_id: VICTIM_ID, status: "active" }

/**
 * Drives the helper through a real Hono context, setting `user` and
 * `token_owner` exactly as authMiddleware would.
 */
async function runCheck(opts: {
  tokenOwnerId: number
  claimedUserId: number
  capabilities?: string[]
}) {
  const app = new Hono()
  let result: Awaited<ReturnType<typeof checkSubscriptionAuthorization>> | undefined

  app.get("/check", async (c) => {
    // `user` is the *claimed* identity the middleware resolved from the request.
    c.set("user" as never, { user_id: opts.claimedUserId } as never)
    c.set("token_owner" as never, {
      user_id: opts.tokenOwnerId,
      capabilities: opts.capabilities ?? [],
    } as never)

    result = await checkSubscriptionAuthorization(c as never, victimSubscription.subscription_id)
    return c.json({ authorized: result.authorized })
  })

  await app.request("/check")
  return result!
}

describe("checkSubscriptionAuthorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindById.mockResolvedValue(victimSubscription as never)
  })

  it("authorizes the real owner", async () => {
    const result = await runCheck({ tokenOwnerId: VICTIM_ID, claimedUserId: VICTIM_ID })
    expect(result.authorized).toBe(true)
  })

  it("authorizes an admin holding payments_create", async () => {
    const result = await runCheck({
      tokenOwnerId: ATTACKER_ID,
      claimedUserId: ATTACKER_ID,
      capabilities: ["payments_create"],
    })
    expect(result.authorized).toBe(true)
  })

  // The defect: ownership was decided against `user` — the identity the caller
  // supplies — so claiming the victim's id made the check pass for the victim's
  // own subscription.
  it("does NOT authorize a caller who merely CLAIMS to be the owner", async () => {
    const result = await runCheck({
      tokenOwnerId: ATTACKER_ID,
      claimedUserId: VICTIM_ID, // attacker asserts the victim's id
      capabilities: [],
    })

    expect(result.authorized).toBe(false)
    expect(result.errorResponse).toBeDefined()
  })

  // The real caller this protects: api-v2's POST /subscriptions/:id/cancel runs as a
  // white-label admin who holds `payments_delete` but NOT `payments_create`, and is
  // not the subscription owner. It passes the owner's user_id in the body. Before the
  // fix that worked only because `isOwner` compared the claimed identity; the admin
  // capability is what must carry it now.
  it("authorizes a white-label admin holding payments_delete acting on an owner's subscription", async () => {
    const result = await runCheck({
      tokenOwnerId: ATTACKER_ID, // not the owner
      claimedUserId: VICTIM_ID, // api-v2 passes the owner's id
      capabilities: ["payments_delete"],
    })

    expect(result.authorized).toBe(true)
  })

  it("does not authorize an unrelated caller", async () => {
    const result = await runCheck({
      tokenOwnerId: ATTACKER_ID,
      claimedUserId: ATTACKER_ID,
      capabilities: [],
    })
    expect(result.authorized).toBe(false)
  })

  it("reports a missing subscription rather than authorizing", async () => {
    mockFindById.mockResolvedValue(undefined as never)

    const result = await runCheck({ tokenOwnerId: VICTIM_ID, claimedUserId: VICTIM_ID })
    expect(result.authorized).toBe(false)
  })
})
