import axios from "axios"
import type { Kysely } from "kysely"
import type { DB } from "@api/lib/db"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { IHomeUptickApiClient } from "./homeuptick-api.interface"

/**
 * HomeUptick API Client
 *
 * Makes HTTP calls to the HomeUptick service to manage accounts and contact limits.
 * Requires HOMEUPTICK_URL to be set in the environment.
 *
 * The getClientCount method authenticates via the user's api_token (from the Users
 * table) and calls the HU /api/clients/count endpoint.
 */
export class HomeUptickApiClient implements IHomeUptickApiClient {
  private readonly baseUrl: string

  constructor(
    config: IConfig,
    private readonly logger: ILogger,
    private readonly db?: Kysely<DB>
  ) {
    this.baseUrl = config.homeuptickUrl ?? ""
    if (!this.baseUrl) {
      this.logger.warn("HomeUptick URL not configured — HomeUptick API calls will fail")
    }
  }

  private get headers() {
    return { "Content-Type": "application/json" }
  }

  // TODO: createAccount, activateAccount, deactivateAccount, and setContactLimit
  // are no-ops until the HomeUptick service exposes real billing endpoints.
  // The /api/billing/accounts/* paths these originally called do not exist.

  async createAccount(userId: number, _config: object): Promise<void> {
    this.logger.info("HomeUptick createAccount — no-op (endpoint not yet available)", { userId })
  }

  async activateAccount(userId: number): Promise<void> {
    this.logger.info("HomeUptick activateAccount — no-op (endpoint not yet available)", { userId })
  }

  async deactivateAccount(userId: number): Promise<void> {
    this.logger.info("HomeUptick deactivateAccount — no-op (endpoint not yet available)", { userId })
  }

  async getClientCount(userId: number): Promise<number> {
    this.logger.debug("Fetching HomeUptick client count", { userId })

    if (!this.db) {
      throw new Error("HomeUptick API client requires database access to resolve user api_token")
    }

    const user = await this.db
      .selectFrom("Users")
      .where("user_id", "=", userId)
      .select("api_token")
      .executeTakeFirst()

    if (!user?.api_token) {
      // User hasn't connected to HomeUptick yet — they can't have contacts, so 0 is correct
      this.logger.debug("User has no api_token — skipping HU client count (treating as 0)", { userId })
      return 0
    }

    const response = await axios.get(
      `${this.baseUrl}/api/clients/count`,
      { headers: { ...this.headers, "x-api-token": user.api_token } }
    )
    return response.data?.count ?? 0
  }

  async setContactLimit(userId: number, limit: number): Promise<void> {
    this.logger.info("HomeUptick setContactLimit — no-op (endpoint not yet available)", { userId, limit })
  }
}

export function createHomeUptickApiClient(config: IConfig, logger: ILogger, db?: Kysely<DB>): IHomeUptickApiClient {
  return new HomeUptickApiClient(config, logger, db)
}
