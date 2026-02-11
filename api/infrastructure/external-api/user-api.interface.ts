/**
 * User API Client Interface
 * Abstracts external user API calls
 */
export interface IUserApiClient {
  /**
   * Get user by ID
   */
  getUser(userId: number): Promise<User | null>

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<User | null>

  /**
   * Create a new user
   */
  createUser(userData: CreateUserRequest): Promise<User>

  /**
   * Update user
   */
  updateUser(userId: number, userData: Partial<User>): Promise<User>

  /**
   * Activate user premium status
   */
  activateUserPremium(userId: number): Promise<void>

  /**
   * Deactivate user premium status
   */
  deactivateUserPremium(userId: number): Promise<void>
}

/**
 * User data from external API
 */
export interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  active: boolean
  is_premium: boolean
  created_at: string
  updated_at: string
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  password?: string
  // New fields from product configuration
  is_premium?: 0 | 1
  role?: string
  whitelabel_id?: number
}
