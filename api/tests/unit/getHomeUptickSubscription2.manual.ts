import "dotenv/config"
import { describe, it, expect, vi, beforeEach } from "vitest"
import getHomeUptickSubscription from "@api/utils/getHomeUptickSubscription"

/**
 * SKIPPED: this is a manual probe, not a unit test.
 *
 * It calls the real `getHomeUptickSubscription` with no mocks against a hardcoded
 * user id, so it needs live database credentials — it fails collection in the unit
 * tier with "Missing required environment variables". Sitting in `api/tests/unit`
 * it was silently contributing zero tests rather than failing loudly.
 *
 * Kept rather than deleted because it is useful to run by hand against a real
 * environment. Unskip locally with a populated `.env`; the mocked coverage of this
 * function lives in `getHomeUptickSubscription.test.ts`.
 */
describe.skip("getHomeUptickSubscription user 94 (manual probe — needs a live DB)", () => {
  // reset mocks
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("handles user with id 94 correctly", async () => {
    const user_id = 94
    const info = await getHomeUptickSubscription(user_id)

    console.log("!!!!!!!!", info)
  })
})
