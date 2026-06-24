import axios from "axios"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ICommissionApiClient, CommissionAccrualInput } from "./commission-api.interface"
import { DEFAULT_HTTP_TIMEOUT_MS, withHttpRetry } from "./http-retry"

/**
 * Commission API Client Implementation
 *
 * POSTs to api-v2's internal commission endpoints. Mirrors `UserApiClient`'s
 * outbound pattern (axios + master token + transient-failure retry), but targets
 * the v2 base (`config.api.urlV2`) and the `/internal/commissions/*` routes.
 *
 * Correctness note: a failed push is NOT fatal — the api-v2 reconciliation sweep
 * over the shared `Transactions` table reconciles anything this misses. The
 * accrue/reverse endpoints are idempotent (unique key on transaction_id + role),
 * so the retry below is safe and a double-delivery is harmless.
 */
export class CommissionApiClient implements ICommissionApiClient {
  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    this.logger.debug("Commission API client initialized", { apiUrl: config.api.urlV2 })
  }

  private async post(path: string, input: CommissionAccrualInput): Promise<void> {
    const url = `${this.config.api.urlV2}${path}`
    const startTime = Date.now()

    await withHttpRetry(
      () =>
        axios.post(url, input, {
          headers: {
            "Content-Type": "application/json",
            "x-api-token": this.config.api.masterToken,
          },
          timeout: DEFAULT_HTTP_TIMEOUT_MS,
        }),
      {
        onRetry: ({ attempt, delayMs, error }) => {
          this.logger.warn("Retrying commission API request after transient failure", {
            path,
            transactionId: input.transaction_id,
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          })
        },
      }
    )

    this.logger.debug("Commission API request ok", {
      path,
      transactionId: input.transaction_id,
      duration: Date.now() - startTime,
    })
  }

  async accrue(input: CommissionAccrualInput): Promise<void> {
    await this.post("/internal/commissions/accrue", input)
  }

  async reverse(input: CommissionAccrualInput): Promise<void> {
    await this.post("/internal/commissions/reverse", input)
  }
}

/**
 * Create a commission API client
 */
export const createCommissionApiClient = (config: IConfig, logger: ILogger): ICommissionApiClient => {
  return new CommissionApiClient(config, logger)
}
