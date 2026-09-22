import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type {
  IUserApiClient,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  CreateTeamRequest,
  Team,
} from "../user-api.interface"
import { DEFAULT_HTTP_TIMEOUT_MS, withHttpRetry } from "../http-retry"
import {
  bitsOf,
  deriveRoleV2FromLegacy,
  isPaidRoleV2,
  isRoleV2,
  legacyOf,
  type RoleV2,
} from "@api/domain/services/role-v2"

/**
 * User API Client Implementation
 * Handles communication with the main user API
 */
export class UserApiClient implements IUserApiClient {
  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    this.logger.debug("User API client initialized", {
      apiUrl: config.api.url,
    })
  }

  /**
   * Wrap an outbound API call with a timeout (applied per-request by callers)
   * and exponential-backoff retry on transient failures (network errors, 429,
   * 5xx including Cloudflare 522). Without this a single origin blip during the
   * renewal cron fails provisioning and pages on-call.
   */
  private withRetry<T>(operation: () => Promise<T>, context: Record<string, unknown>): Promise<T> {
    return withHttpRetry(operation, {
      onRetry: ({ attempt, delayMs, error }) => {
        this.logger.warn("Retrying user API request after transient failure", {
          ...context,
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        })
      },
    })
  }

  async getUser(userId: number): Promise<User | null> {
    const startTime = Date.now()

    try {
      this.logger.debug("Fetching user from API", { userId })

      const response = await this.withRetry(
        () =>
          axios.get(`${this.config.api.url}/users/${userId}`, {
            headers: {
              "x-api-token": this.config.api.masterToken,
            },
            timeout: DEFAULT_HTTP_TIMEOUT_MS,
            validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          }),
        { operation: "getUser", userId }
      )

      if (response.status === 404) {
        this.logger.debug("User not found", { userId })
        return null
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.debug("User fetched successfully", { userId, duration })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to fetch user", error, { userId, duration })
      throw error
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const startTime = Date.now()

    try {
      this.logger.debug("Fetching user by email from API", { email })

      const response = await this.withRetry(
        () =>
          axios.get(`${this.config.api.url}/users?email=${encodeURIComponent(email)}`, {
            headers: {
              "x-api-token": this.config.api.masterToken,
            },
            timeout: DEFAULT_HTTP_TIMEOUT_MS,
          }),
        { operation: "getUserByEmail", email }
      )

      const data: any = response.data
      const duration = Date.now() - startTime

      if (data.success === "success" && data.data && data.data.length > 0) {
        this.logger.debug("User found by email", { email, duration })
        return this.parseUser(data.data[0])
      }

      this.logger.debug("User not found by email", { email, duration })
      return null
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to fetch user by email", error, { email, duration })
      throw error
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const startTime = Date.now()

    // A create carrying `role_v2` also carries the legacy pair it implies, so a main API that has
    // not yet learned the key still lands the user in the right family rather than with no role at
    // all. Whatever the caller already passed wins, this only fills gaps.
    const body: CreateUserRequest = { ...userData }
    if (isRoleV2(body.role_v2)) {
      if (body.role === undefined) body.role = legacyOf(body.role_v2)
      const bits = bitsOf(body.role_v2)
      if (body.is_premium === undefined && bits) body.is_premium = bits.is_premium
    }

    try {
      this.logger.info("Creating new user via API", { email: userData.email })

      // POST is not idempotent: a timeout-then-retry could create a duplicate
      // user if the origin processed the first request. Use a timeout but no retry.
      const response = await axios.post(`${this.config.api.url}/users`, body, {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.config.api.masterToken,
        },
        timeout: DEFAULT_HTTP_TIMEOUT_MS,
      })

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.info("User created successfully", {
        email: userData.email,
        userId: data.data?.id,
        duration,
      })

      const created = this.parseUserResponse(data)

      // The legacy pair cannot express every tier. `(AGENT, is_premium 0)` reads back as
      // `AGENT_FREE`, so an eXp Guest, Pro or Elite created through the pair alone silently lands
      // on the wrong tier, free for Guest and Pro, plain Premium for Elite. Where the pair the
      // create just sent does not read back as the role that was asked for, say it directly.
      // Cheap and self-limiting: for every tier the pair can express, this is skipped.
      if (isRoleV2(body.role_v2) && deriveRoleV2FromLegacy(body.role, body.is_premium) !== body.role_v2) {
        await this.setUserRole(created.id, body.role_v2)
        created.role_v2 = body.role_v2
      }

      return created
    } catch (error) {
      const duration = Date.now() - startTime
      const responseData = (error as any)?.response?.data
      this.logger.error("Failed to create user", error, {
        email: userData.email,
        duration,
        responseData,
      })
      if (responseData) {
        const detail = typeof responseData === "string" ? responseData : JSON.stringify(responseData)
        throw new Error(`Request failed with status code ${(error as any).response.status}: ${detail}`)
      }
      throw error
    }
  }

  async setUserRole(userId: number, roleV2: string): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Setting user role via API", { userId, roleV2 })

      await this.withRetry(
        () =>
          axios.put(
            `${this.config.api.url}/users/${userId}/role`,
            { role_v2: roleV2 },
            {
              headers: {
                "Content-Type": "application/json",
                "x-api-token": this.config.api.masterToken,
              },
              timeout: DEFAULT_HTTP_TIMEOUT_MS,
            }
          ),
        { operation: "setUserRole", userId, roleV2 }
      )

      this.logger.info("User role updated", { userId, roleV2, duration: Date.now() - startTime })
    } catch (error) {
      // A 404 here is the main API not having the endpoint yet, not a missing user: it ships in the
      // mono repo's Phase 7 (#1007), and this repo is meant to deploy without waiting for it. So
      // the role goes the way it always went, as the legacy pair on the generic update, which that
      // API still accepts from the master token. A missing user 404s there too and surfaces.
      if ((error as any)?.response?.status === 404 && isRoleV2(roleV2)) {
        await this.setUserRoleViaLegacyPair(userId, roleV2)
        return
      }

      const responseData = (error as any)?.response?.data
      this.logger.error("Failed to set user role", error, {
        userId,
        roleV2,
        duration: Date.now() - startTime,
        responseData,
      })
      if (responseData) {
        const detail = typeof responseData === "string" ? responseData : JSON.stringify(responseData)
        throw new Error(`Request failed with status code ${(error as any).response.status}: ${detail}`)
      }
      throw error
    }
  }

  /**
   * The pre-Phase-7 transport for a role, used only while the role endpoint 404s.
   *
   * **Refuses a tier the pair cannot say**, rather than writing the nearest one. `(AGENT, 0)` reads
   * back as `AGENT_FREE`, so an Express Offers Pro sent this way would be a paying customer quietly
   * made free, and an Elite would land on plain Premium. No eXp tier is enrolled and the paid path is
   * closed until the mono repo's Phase 7 ships, which is also when this fallback stops being reached,
   * so a loud failure costs nothing real and a silent one would charge the wrong price.
   */
  private async setUserRoleViaLegacyPair(userId: number, roleV2: RoleV2): Promise<void> {
    const role = legacyOf(roleV2)
    const bits = bitsOf(roleV2)
    const body: Record<string, unknown> = { role, ...(bits ?? {}) }

    if (deriveRoleV2FromLegacy(role, bits?.is_premium) !== roleV2) {
      this.logger.error("Role endpoint unavailable and the legacy pair cannot express this tier", undefined, {
        userId,
        roleV2,
      })
      throw new Error(
        `Cannot set ${roleV2} on user ${userId}: PUT /users/:id/role is not available on the main API yet`
      )
    }

    this.logger.warn("Role endpoint unavailable, writing the legacy pair", { userId, roleV2, body })
    await this.withRetry(
      () =>
        axios.put(`${this.config.api.url}/users/${userId}`, body, {
          headers: {
            "Content-Type": "application/json",
            "x-api-token": this.config.api.masterToken,
          },
          timeout: DEFAULT_HTTP_TIMEOUT_MS,
        }),
      { operation: "setUserRoleViaLegacyPair", userId, roleV2 }
    )
  }

  async sendPasswordReset(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Requesting password reset email via API", { userId })

      await axios.post(
        `${this.config.api.url}/users/${userId}/send-password-reset`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-token": this.config.api.masterToken,
          },
          timeout: DEFAULT_HTTP_TIMEOUT_MS,
        }
      )

      this.logger.info("Password reset email requested", { userId, duration: Date.now() - startTime })
    } catch (error) {
      const responseData = (error as any)?.response?.data
      this.logger.error("Failed to request password reset", error, {
        userId,
        duration: Date.now() - startTime,
        responseData,
      })
      if (responseData) {
        const detail = typeof responseData === "string" ? responseData : JSON.stringify(responseData)
        throw new Error(`Request failed with status code ${(error as any).response.status}: ${detail}`)
      }
      throw error
    }
  }

  async updateUser(userId: number, userData: UpdateUserRequest): Promise<User> {
    const startTime = Date.now()

    // Guard: never strip premium from integration-managed users. Their premium
    // is governed by an external integration (KW Community / Chargify), not by
    // this Square billing system, so a lapse/cancel here must not downgrade
    // them. A KW agent updating her card was wrongly moved to free (#1494; same
    // root cause as #1473). Any update that turns is_premium off for a user
    // with integration_id set is skipped entirely (this also covers the
    // role=SHELL downgrade path) and logged for audit.
    // A role_v2 that is not a paid role is the same request said in the new vocabulary: the
    // suspension path stopped sending `is_premium: 0` and started sending `AGENT_FREE`/`SHELL`, and
    // a guard that only watched the bit would have stopped firing the day that landed, reopening
    // #1473/#1494 for every KW agent with an integration, silently, on lapse.
    const roleV2WantsPremiumOff = isRoleV2(userData.role_v2) && !isPaidRoleV2(userData.role_v2)
    const wantsPremiumOff = userData.is_premium === 0 || userData.is_premium === false || roleV2WantsPremiumOff
    if (wantsPremiumOff) {
      const existing = await this.getUser(userId)
      if (existing && existing.integration_id != null) {
        this.logger.warn("Skipping premium downgrade for integration-managed user", {
          userId,
          integrationId: existing.integration_id,
          requested: userData,
        })
        return existing
      }
    }

    try {
      this.logger.debug("Updating user via API", { userId })

      // Main API requires is_premium / active as 0|1, not booleans.
      const body: Record<string, unknown> = { ...userData }
      if (typeof body.is_premium === "boolean") body.is_premium = body.is_premium ? 1 : 0
      if (typeof body.active === "boolean") body.active = body.active ? 1 : 0

      // `role_v2` does not travel on this endpoint, the main API strips it from a generic update
      // by design (plan Decision 23: a role is not a field on a profile save). Split it off to the
      // endpoint that owns it, first, so a request that is only a role change still happens even
      // though nothing is left for the generic PUT to do.
      const roleV2 = body.role_v2
      delete body.role_v2
      if (isRoleV2(roleV2)) {
        await this.setUserRole(userId, roleV2)
        if (Object.keys(body).length === 0) {
          const updated = await this.getUser(userId)
          if (updated) return updated
          throw new Error(`User ${userId} not found after role update`)
        }
      }

      const response = await this.withRetry(
        () =>
          axios.put(`${this.config.api.url}/users/${userId}`, body, {
            headers: {
              "Content-Type": "application/json",
              "x-api-token": this.config.api.masterToken,
            },
            timeout: DEFAULT_HTTP_TIMEOUT_MS,
          }),
        { operation: "updateUser", userId }
      )

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.debug("User updated successfully", { userId, duration })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      const responseData = (error as any)?.response?.data
      this.logger.error("Failed to update user", error, {
        userId,
        duration,
        requestBody: userData,
        responseData,
      })
      if (responseData) {
        const detail = typeof responseData === "string" ? responseData : JSON.stringify(responseData)
        throw new Error(`Request failed with status code ${(error as any).response.status}: ${detail}`)
      }
      throw error
    }
  }

  async activateUserPremium(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Activating user premium status", { userId })

      await this.updateUser(userId, { is_premium: true })

      const duration = Date.now() - startTime
      this.logger.info("User premium status activated", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to activate user premium", error, { userId, duration })
      throw error
    }
  }

  async deactivateUserPremium(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Deactivating user premium status", { userId })

      await this.updateUser(userId, { is_premium: false })

      const duration = Date.now() - startTime
      this.logger.info("User premium status deactivated", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to deactivate user premium", error, { userId, duration })
      throw error
    }
  }

  async deactivateUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Deactivating user (setting active = false)", { userId })

      await this.updateUser(userId, { active: false })

      const duration = Date.now() - startTime
      this.logger.info("User deactivated successfully", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to deactivate user", error, { userId, duration })
      throw error
    }
  }

  async shellUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Shelling user (setting role = SHELL, is_premium = false)", { userId })

      await this.updateUser(userId, { role: "SHELL", is_premium: false })

      const duration = Date.now() - startTime
      this.logger.info("User shelled successfully", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to shell user", error, { userId, duration })
      throw error
    }
  }

  async activateUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Fully activating user (setting active = true, is_premium = true, role = AGENT)", { userId })

      await this.updateUser(userId, { active: true, is_premium: true, role: "AGENT" })

      const duration = Date.now() - startTime
      this.logger.info("User fully activated successfully", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to fully activate user", error, { userId, duration })
      throw error
    }
  }

  async abandonUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Abandoning user created during failed purchase", { userId })

      const scrambledEmail = `abandoned_${uuidv4()}@deleted.invalid`
      await this.updateUser(userId, { active: false, email: scrambledEmail })

      const duration = Date.now() - startTime
      this.logger.info("User abandoned successfully", { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to abandon user", error, { userId, duration })
      throw error
    }
  }

  async createTeam(params: CreateTeamRequest): Promise<Team> {
    const startTime = Date.now()

    try {
      this.logger.info("Creating team via API", { teamname: params.teamname, ownerId: params.owner_id })

      // POST is not idempotent: no retry, to avoid creating a duplicate team.
      const response = await axios.post(`${this.config.api.url}/teams`, params, {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.config.api.masterToken,
        },
        timeout: DEFAULT_HTTP_TIMEOUT_MS,
      })

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.info("Team created successfully", {
        teamId: data.data?.id || data.data?.team_id,
        teamname: params.teamname,
        duration,
      })

      return this.parseTeamResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      const responseData = (error as any)?.response?.data
      this.logger.error("Failed to create team", error, {
        teamname: params.teamname,
        ownerId: params.owner_id,
        duration,
        responseData,
      })
      if (responseData) {
        const detail = typeof responseData === "string" ? responseData : JSON.stringify(responseData)
        throw new Error(`Failed to create team: ${(error as any).response.status}: ${detail}`)
      }
      throw error
    }
  }

  private parseTeamResponse(data: any): Team {
    if (data.success === "success" && data.data) {
      const t = data.data
      return {
        id: t.team_id || t.id,
        name: t.teamname || t.name,
        owner_id: t.owner_id,
      }
    }
    throw new Error("Invalid API response format for team")
  }

  private parseUserResponse(data: any): User {
    if (data.success === "success" && data.data) {
      return this.parseUser(data.data)
    }
    throw new Error("Invalid API response format")
  }

  private parseUser(userData: any): User {
    return {
      id: userData.user_id || userData.id,
      email: userData.email,
      first_name: userData.first_name || userData.name?.split(" ")[0],
      last_name: userData.last_name || userData.name?.split(" ")[1],
      phone: userData.phone,
      active: Boolean(userData.active),
      is_premium: Boolean(userData.is_premium),
      created_at: userData.created || userData.created_at || new Date().toISOString(),
      updated_at: userData.updated || userData.updated_at || new Date().toISOString(),
      reset_token: userData.reset_token,
      // `role` was never parsed out, so every `user.role` read in this repo was reading a field the
      // client had already dropped and comparing `undefined` to a product's role. That made the
      // handlers' needsUpdate comparison always true on the role half. Both halves are carried now.
      role: userData.role ?? undefined,
      role_v2: userData.role_v2 ?? null,
      whitelabel_id: userData.whitelabel_id ?? undefined,
      integration_id: userData.integration_id ?? null,
    }
  }
}

/**
 * Create a user API client
 */
export const createUserApiClient = (config: IConfig, logger: ILogger): IUserApiClient => {
  return new UserApiClient(config, logger)
}
