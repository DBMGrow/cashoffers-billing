import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import type { IConfig } from "@api/config/config.interface"
import type { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { IUserApiClient, User, CreateUserRequest, CreateTeamRequest, Team } from "../user-api.interface"

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

  async getUser(userId: number): Promise<User | null> {
    const startTime = Date.now()

    try {
      this.logger.debug("Fetching user from API", { userId })

      const response = await axios.get(`${this.config.api.url}/users/${userId}`, {
        headers: {
          "x-api-token": this.config.api.masterToken,
        },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      })

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

      const response = await axios.get(`${this.config.api.url}/users?email=${encodeURIComponent(email)}`, {
        headers: {
          "x-api-token": this.config.api.masterToken,
        },
      })

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

    try {
      this.logger.info("Creating new user via API", { email: userData.email })

      const response = await axios.post(`${this.config.api.url}/users`, userData, {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.config.api.masterToken,
        },
      })

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.info("User created successfully", {
        email: userData.email,
        userId: data.data?.id,
        duration,
      })

      return this.parseUserResponse(data)
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

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    const startTime = Date.now()

    try {
      this.logger.debug("Updating user via API", { userId })

      const response = await axios.put(`${this.config.api.url}/users/${userId}`, userData, {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.config.api.masterToken,
        },
      })

      const data: any = response.data
      const duration = Date.now() - startTime

      this.logger.debug("User updated successfully", { userId, duration })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Failed to update user", error, { userId, duration })
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

  async activateUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info("Fully activating user (setting active = true AND is_premium = true)", { userId })

      await this.updateUser(userId, { active: true, is_premium: true })

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

      const response = await axios.post(`${this.config.api.url}/teams`, params, {
        headers: {
          "Content-Type": "application/json",
          "x-api-token": this.config.api.masterToken,
        },
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
      whitelabel_id: userData.whitelabel_id ?? undefined,
    }
  }
}

/**
 * Create a user API client
 */
export const createUserApiClient = (config: IConfig, logger: ILogger): IUserApiClient => {
  return new UserApiClient(config, logger)
}
