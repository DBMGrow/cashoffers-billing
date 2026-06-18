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
