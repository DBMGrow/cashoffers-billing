import fetch from 'node-fetch'
import type { IConfig } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type {
  IUserApiClient,
  User,
  CreateUserRequest,
} from '../user-api.interface'

/**
 * User API Client Implementation
 * Handles communication with the main user API
 */
export class UserApiClient implements IUserApiClient {
  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    this.logger.debug('User API client initialized', {
      apiUrl: config.api.url,
    })
  }

  async getUser(userId: number): Promise<User | null> {
    const startTime = Date.now()

    try {
      this.logger.debug('Fetching user from API', { userId })

      const response = await fetch(`${this.config.api.url}/users/${userId}`, {
        headers: {
          'x-api-token': this.config.api.masterToken,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.debug('User not found', { userId })
          return null
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = await response.json()
      const duration = Date.now() - startTime

      this.logger.debug('User fetched successfully', { userId, duration })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to fetch user', error, { userId, duration })
      throw error
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const startTime = Date.now()

    try {
      this.logger.debug('Fetching user by email from API', { email })

      const response = await fetch(`${this.config.api.url}/users?email=${encodeURIComponent(email)}`, {
        headers: {
          'x-api-token': this.config.api.masterToken,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = await response.json()
      const duration = Date.now() - startTime

      if (data.success === 'success' && data.data && data.data.length > 0) {
        this.logger.debug('User found by email', { email, duration })
        return this.parseUser(data.data[0])
      }

      this.logger.debug('User not found by email', { email, duration })
      return null
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to fetch user by email', error, { email, duration })
      throw error
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const startTime = Date.now()

    try {
      this.logger.info('Creating new user via API', { email: userData.email })

      const response = await fetch(`${this.config.api.url}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': this.config.api.masterToken,
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = await response.json()
      const duration = Date.now() - startTime

      this.logger.info('User created successfully', {
        email: userData.email,
        userId: data.data?.id,
        duration,
      })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to create user', error, {
        email: userData.email,
        duration,
      })
      throw error
    }
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    const startTime = Date.now()

    try {
      this.logger.debug('Updating user via API', { userId })

      const response = await fetch(`${this.config.api.url}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': this.config.api.masterToken,
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: any = await response.json()
      const duration = Date.now() - startTime

      this.logger.debug('User updated successfully', { userId, duration })

      return this.parseUserResponse(data)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to update user', error, { userId, duration })
      throw error
    }
  }

  async activateUserPremium(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Activating user premium status', { userId })

      await this.updateUser(userId, { is_premium: true })

      const duration = Date.now() - startTime
      this.logger.info('User premium status activated', { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to activate user premium', error, { userId, duration })
      throw error
    }
  }

  async deactivateUserPremium(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Deactivating user premium status', { userId })

      await this.updateUser(userId, { is_premium: false })

      const duration = Date.now() - startTime
      this.logger.info('User premium status deactivated', { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to deactivate user premium', error, { userId, duration })
      throw error
    }
  }

  async deactivateUser(userId: number): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Deactivating user (setting active = false)', { userId })

      await this.updateUser(userId, { active: false })

      const duration = Date.now() - startTime
      this.logger.info('User deactivated successfully', { userId, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to deactivate user', error, { userId, duration })
      throw error
    }
  }

  private parseUserResponse(data: any): User {
    if (data.success === 'success' && data.data) {
      return this.parseUser(data.data)
    }
    throw new Error('Invalid API response format')
  }

  private parseUser(userData: any): User {
    return {
      id: userData.user_id || userData.id,
      email: userData.email,
      first_name: userData.first_name || userData.name?.split(' ')[0],
      last_name: userData.last_name || userData.name?.split(' ')[1],
      phone: userData.phone,
      active: Boolean(userData.active),
      is_premium: Boolean(userData.is_premium),
      created_at: userData.created || userData.created_at || new Date().toISOString(),
      updated_at: userData.updated || userData.updated_at || new Date().toISOString(),
    }
  }
}

/**
 * Create a user API client
 */
export const createUserApiClient = (config: IConfig, logger: ILogger): IUserApiClient => {
  return new UserApiClient(config, logger)
}
