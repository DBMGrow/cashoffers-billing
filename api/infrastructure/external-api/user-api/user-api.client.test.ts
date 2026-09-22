import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"
import { UserApiClient } from "./user-api.client"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"

vi.mock("axios")

const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger
}

function makeConfig(): IConfig {
  return { api: { url: "https://api.test", masterToken: "tok" } } as unknown as IConfig
}

function userResponse(overrides: Record<string, unknown>) {
  return {
    status: 200,
    data: {
      success: "success",
      data: { user_id: 26126, email: "a@kw.com", is_premium: 1, active: 1, ...overrides },
    },
  }
}

describe("UserApiClient.updateUser — integration-managed premium guard", () => {
  let client: UserApiClient
  let logger: ILogger

  beforeEach(() => {
    vi.clearAllMocks()
    logger = makeLogger()
    client = new UserApiClient(makeConfig(), logger)
  })

  it("skips premium downgrade for an integration-managed user (no PUT)", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    const result = await client.updateUser(26126, { is_premium: 0 })

    expect(mockedAxios.put).not.toHaveBeenCalled()
    expect(result.is_premium).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping premium downgrade for integration-managed user",
      expect.objectContaining({ userId: 26126, integrationId: 1 })
    )
  })

  it("skips the role=SHELL downgrade too for an integration-managed user", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    await client.updateUser(26126, { role: "SHELL", is_premium: 0 })

    expect(mockedAxios.put).not.toHaveBeenCalled()
  })

  it("downgrades a non-integration user normally (PUT sent)", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: null, is_premium: 1 }))
    mockedAxios.put.mockResolvedValue(userResponse({ integration_id: null, is_premium: 0 }))

    await client.updateUser(555, { is_premium: 0 })

    expect(mockedAxios.put).toHaveBeenCalledTimes(1)
    const [, body] = mockedAxios.put.mock.calls[0]
    expect(body).toMatchObject({ is_premium: 0 })
  })

  it("deactivateUserPremium is a no-op for an integration-managed user", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    await client.deactivateUserPremium(26126)

    expect(mockedAxios.put).not.toHaveBeenCalled()
  })

  it("does not gate non-downgrade updates (is_premium:1 still PUTs for integration user)", async () => {
    mockedAxios.put.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    await client.updateUser(26126, { is_premium: 1 })

    // is_premium:1 is not a downgrade, so no pre-fetch guard and the PUT goes through.
    expect(mockedAxios.put).toHaveBeenCalledTimes(1)
  })
})

describe("UserApiClient, role_v2 transport (plan CO-I271 §9.4)", () => {
  let client: UserApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new UserApiClient(makeConfig(), makeLogger())
  })

  it("sends a role change to the role endpoint, not as a field on the user update", async () => {
    // The generic PUT strips `role_v2` unconditionally on the main API's side, so a role sent as a
    // body field there is not a partial success, it is a silent no-op: the call returns 200 and the
    // user does not move. This assertion is the whole reason the client splits the request.
    mockedAxios.put.mockResolvedValue(userResponse({ role_v2: "AGENT_EXP_ELITE" }))
    mockedAxios.get.mockResolvedValue(userResponse({ role_v2: "AGENT_EXP_ELITE" }))

    await client.updateUser(26126, { role_v2: "AGENT_EXP_ELITE" })

    const [url, body] = mockedAxios.put.mock.calls[0]
    expect(url).toBe("https://api.test/users/26126/role")
    expect(body).toEqual({ role_v2: "AGENT_EXP_ELITE" })
  })

  it("splits a mixed update: the role to its endpoint, everything else to the user", async () => {
    mockedAxios.put.mockResolvedValue(userResponse({}))

    await client.updateUser(26126, { role_v2: "AGENT_PREMIUM", whitelabel_id: 7 })

    expect(mockedAxios.put).toHaveBeenCalledTimes(2)
    expect(mockedAxios.put.mock.calls[0][0]).toBe("https://api.test/users/26126/role")
    expect(mockedAxios.put.mock.calls[1][0]).toBe("https://api.test/users/26126")
    expect(mockedAxios.put.mock.calls[1][1]).toEqual({ whitelabel_id: 7 })
    expect(mockedAxios.put.mock.calls[1][1]).not.toHaveProperty("role_v2")
  })

  it("still refuses to downgrade an integration-managed user when the downgrade is spelled as a role", async () => {
    // #1473/#1494 said the guard in terms of the premium bit. The suspension path stopped sending
    // that bit, so a guard that only watched it would have gone quiet without anything failing.
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    const result = await client.updateUser(26126, { role_v2: "AGENT_FREE" })

    expect(mockedAxios.put).not.toHaveBeenCalled()
    expect(result.is_premium).toBe(true)
  })

  it("refuses a SHELL downgrade for an integration-managed user, said either way", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ integration_id: 1, is_premium: 1 }))

    await client.updateUser(26126, { role_v2: "SHELL" })

    expect(mockedAxios.put).not.toHaveBeenCalled()
  })

  it("does not gate a move onto a paid role", async () => {
    mockedAxios.put.mockResolvedValue(userResponse({}))
    mockedAxios.get.mockResolvedValue(userResponse({}))

    await client.updateUser(26126, { role_v2: "AGENT_EXP_ELITE" })

    expect(mockedAxios.put).toHaveBeenCalledTimes(1)
  })

  it("carries the legacy pair on a create, so an API that ignores role_v2 still lands the family", async () => {
    mockedAxios.post.mockResolvedValue(userResponse({ user_id: 900 }))

    await client.createUser({ email: "new@test.com", role_v2: "AGENT_PREMIUM" })

    const [, body] = mockedAxios.post.mock.calls[0]
    expect(body).toMatchObject({ role_v2: "AGENT_PREMIUM", role: "AGENT", is_premium: 1 })
    // AGENT + is_premium 1 reads back as AGENT_PREMIUM, so nothing more needs saying.
    expect(mockedAxios.put).not.toHaveBeenCalled()
  })

  it("follows a create with a role write when the legacy pair cannot express the tier", async () => {
    // AGENT + is_premium 1 reads back as AGENT_PREMIUM, not Elite. Without the follow-up the
    // subscriber is created one tier down and nothing reports it, because the pair is consistent.
    mockedAxios.post.mockResolvedValue(userResponse({ user_id: 901 }))
    mockedAxios.put.mockResolvedValue(userResponse({ user_id: 901 }))

    const created = await client.createUser({ email: "elite@test.com", role_v2: "AGENT_EXP_ELITE" })

    expect(mockedAxios.put).toHaveBeenCalledTimes(1)
    expect(mockedAxios.put.mock.calls[0][0]).toBe("https://api.test/users/901/role")
    expect(created.role_v2).toBe("AGENT_EXP_ELITE")
  })

  it("leaves a create with no role_v2 exactly as it was", async () => {
    mockedAxios.post.mockResolvedValue(userResponse({ user_id: 902 }))

    await client.createUser({ email: "legacy@test.com", role: "AGENT", is_premium: 1 })

    const [, body] = mockedAxios.post.mock.calls[0]
    expect(body).toEqual({ email: "legacy@test.com", role: "AGENT", is_premium: 1 })
    expect(mockedAxios.put).not.toHaveBeenCalled()
  })

  it("parses role and role_v2 off a user read", async () => {
    mockedAxios.get.mockResolvedValue(userResponse({ role: "AGENT", role_v2: "AGENT_EXP_PRO" }))

    const user = await client.getUser(26126)

    expect(user?.role).toBe("AGENT")
    expect(user?.role_v2).toBe("AGENT_EXP_PRO")
  })
})
