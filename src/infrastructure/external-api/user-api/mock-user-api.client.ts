import type {
  IUserApiClient,
  User,
  CreateUserRequest,
} from '../user-api.interface'

/**
 * Mock User API Client
 * For testing without hitting real user API
 */
export class MockUserApiClient implements IUserApiClient {
  private users: Map<number, User> = new Map()
  private emailIndex: Map<string, number> = new Map()
  private nextId = 1

  // Configuration for testing different scenarios
  public shouldFail = false
  public failureReason = 'Mock user API failed'

  async getUser(userId: number): Promise<User | null> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    return this.users.get(userId) || null
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const userId = this.emailIndex.get(email.toLowerCase())
    if (!userId) {
      return null
    }

    return this.users.get(userId) || null
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const userId = this.nextId++
    const user: User = {
      id: userId,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone: userData.phone,
      active: true,
      is_premium: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    this.users.set(userId, user)
    this.emailIndex.set(userData.email.toLowerCase(), userId)

    return user
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const user = this.users.get(userId)
    if (!user) {
      throw new Error('User not found')
    }

    const updatedUser: User = {
      ...user,
      ...userData,
      id: userId, // Ensure ID doesn't change
      updated_at: new Date().toISOString(),
    }

    this.users.set(userId, updatedUser)

    // Update email index if email changed
    if (userData.email && userData.email !== user.email) {
      this.emailIndex.delete(user.email.toLowerCase())
      this.emailIndex.set(userData.email.toLowerCase(), userId)
    }

    return updatedUser
  }

  async activateUserPremium(userId: number): Promise<void> {
    await this.updateUser(userId, { is_premium: true })
  }

  async deactivateUserPremium(userId: number): Promise<void> {
    await this.updateUser(userId, { is_premium: false })
  }

  // Test helpers
  addMockUser(user: Partial<User> & { email: string }): User {
    const userId = user.id || this.nextId++
    const fullUser: User = {
      id: userId,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      active: user.active ?? true,
      is_premium: user.is_premium ?? false,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: user.updated_at || new Date().toISOString(),
    }

    this.users.set(userId, fullUser)
    this.emailIndex.set(user.email.toLowerCase(), userId)

    return fullUser
  }

  reset(): void {
    this.users.clear()
    this.emailIndex.clear()
    this.nextId = 1
    this.shouldFail = false
    this.failureReason = 'Mock user API failed'
  }

  getUsers(): User[] {
    return Array.from(this.users.values())
  }

  /**
   * Set whether the next request should fail
   */
  setNextRequestShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail
  }
}

/**
 * Create a mock user API client
 */
export const createMockUserApiClient = (): MockUserApiClient => {
  return new MockUserApiClient()
}
