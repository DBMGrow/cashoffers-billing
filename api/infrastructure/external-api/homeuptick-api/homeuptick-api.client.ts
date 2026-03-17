import axios from "axios"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { IHomeUptickApiClient } from "./homeuptick-api.interface"

/**
 * HomeUptick API Client
 *
 * Makes HTTP calls to the HomeUptick service to manage accounts and contact limits.
 * Requires HOMEUPTICK_URL to be set in the environment.
 */
export class HomeUptickApiClient implements IHomeUptickApiClient {
  private readonly baseUrl: string

  constructor(
    config: IConfig,
    private readonly logger: ILogger
  ) {
    this.baseUrl = config.homeuptickUrl ?? ""
    if (!this.baseUrl) {
      this.logger.warn("HomeUptick URL not configured — HomeUptick API calls will fail")
    }
  }

  private get headers() {
    return { "Content-Type": "application/json" }
  }

  async createAccount(userId: number, config: object): Promise<void> {
    this.logger.info("Creating HomeUptick account", { userId })
    await axios.post(
      `${this.baseUrl}/api/billing/accounts`,
      { user_id: userId, ...config },
      { headers: this.headers }
    )
  }

  async activateAccount(userId: number): Promise<void> {
    this.logger.info("Activating HomeUptick account", { userId })
    await axios.post(
      `${this.baseUrl}/api/billing/accounts/${userId}/activate`,
      {},
      { headers: this.headers }
    )
  }

  async deactivateAccount(userId: number): Promise<void> {
    this.logger.info("Deactivating HomeUptick account", { userId })
    await axios.post(
      `${this.baseUrl}/api/billing/accounts/${userId}/deactivate`,
      {},
      { headers: this.headers }
    )
  }

  async getClientCount(userId: number): Promise<number> {
    this.logger.debug("Fetching HomeUptick client count", { userId })
    const response = await axios.get(
      `${this.baseUrl}/api/billing/accounts/${userId}/clients/count`,
      { headers: this.headers }
    )
    return response.data?.count ?? 0
  }

  async setContactLimit(userId: number, limit: number): Promise<void> {
    this.logger.info("Setting HomeUptick contact limit", { userId, limit })
    await axios.post(
      `${this.baseUrl}/api/billing/accounts/${userId}/contact-limit`,
      { limit },
      { headers: this.headers }
    )
  }
}

export function createHomeUptickApiClient(config: IConfig, logger: ILogger): IHomeUptickApiClient {
  return new HomeUptickApiClient(config, logger)
}
