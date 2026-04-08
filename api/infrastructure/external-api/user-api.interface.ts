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
   * Activate user premium status (sets is_premium = true only)
   */
  activateUserPremium(userId: number): Promise<void>

  /**
   * Deactivate user premium status (sets is_premium = false only)
   */
  deactivateUserPremium(userId: number): Promise<void>

  /**
   * Deactivate user (sets active = false only)
   */
  deactivateUser(userId: number): Promise<void>

  /**
   * Fully activate user (sets both active = true AND is_premium = true)
   * Use this for subscription renewals to ensure users are both active and premium
   */
  activateUser(userId: number): Promise<void>

  /**
   * Abandon a user created during a failed purchase.
   * Sets active=false and scrambles the email so the original address is freed for re-signup.
   */
  abandonUser(userId: number): Promise<void>

  /**
   * Create a team and return the team ID.
   * Used when provisioning team plan subscriptions.
   */
  createTeam(params: CreateTeamRequest): Promise<Team>
}

/**
 * User data from external API
 */
export interface User {
  id: number
  email: string
  name?: string
  first_name?: string
  last_name?: string
  phone?: string
  active: boolean
  is_premium: boolean
  created_at: string
  updated_at: string
  reset_token?: string
  role?: string
  team_id?: number
  whitelabel_id?: number
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  email: string
  name?: string
  first_name?: string
  last_name?: string
  phone?: string
  password?: string
  // New fields from product configuration
  is_premium?: 0 | 1
  role?: string
  whitelabel_id?: number
  // Team fields
  team_id?: number
  // Password reset fields
  reset_token?: string
  reset_created?: string
}

/**
 * Create team request
 */
export interface CreateTeamRequest {
  teamname: string
  owner_id: number
  max_users: number
  whitelabel_id?: number
}

/**
 * Team data from external API
 */
export interface Team {
  id: number
  name: string
  owner_id: number
}
