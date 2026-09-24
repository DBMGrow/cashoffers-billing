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
  updateUser(userId: number, userData: UpdateUserRequest): Promise<User>

  /**
   * Put a user on a role, in the unified vocabulary, `PUT /users/:id/role` (plan CO-I271 §9.2).
   *
   * Its own operation with its own capability, not a field on a user update, because a role is not
   * profile data: as a body field it rides on whatever auth the surrounding save happens to have.
   * The main API derives `role`, `is_premium` and `is_lite` from this in the same statement, so
   * every unconverted reader of the legacy columns stays correct.
   *
   * Callers normally reach this through `updateUser({ role_v2 })`, which splits the request; it is
   * on the interface because a role change with nothing else to say is a first-class thing to do.
   */
  setUserRole(userId: number, roleV2: string): Promise<void>

  /**
   * Ask the main API to mint a fresh password-reset token and email it to the user.
   *
   * The purchase flow suppresses the welcome email when provisioning fails
   * (email-notification.handler: `userWasCreated === false`), so a user repaired by
   * hand afterwards has `password = 'NONE'` and no way in. This is the supported way
   * to give them one — the main API owns token generation and delivery, so nothing
   * here invents a token or writes `reset_token` directly.
   */
  sendPasswordReset(userId: number): Promise<void>

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
   * Shell a user: sets role = SHELL and is_premium = false.
   * Used for non-KW white labels on subscription lapse — the account stays
   * accessible so the user can log in and see the resubscribe prompt.
   */
  shellUser(userId: number): Promise<void>

  /**
   * Fully activate user (sets active = true, is_premium = true, role = AGENT).
   * Use this for subscription renewals and payment recovery.
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
  /**
   * The user's role in the unified vocabulary, RBAC unification plan CO-I271, Phase 4 shipped the
   * column. Optional because the main API may not surface it on every read shape; when it is
   * absent, `resolveUserRoleV2` derives it from `role` and `is_premium`.
   */
  role_v2?: string | null
  team_id?: number
  whitelabel_id?: number
  /**
   * External integration that governs this user's premium status (e.g. KW
   * Community / Chargify = 1). When set, premium is controlled by that
   * integration — the billing system must NOT strip premium from these users.
   * See updateUser() guard (#1473, #1494).
   */
  integration_id?: number | null
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
  slug?: string
  name_team?: string
  name_broker?: string
  city?: string
  state?: string
  // New fields from product configuration
  is_premium?: 0 | 1
  role?: string
  /**
   * The role to create the user on, in the unified vocabulary (plan CO-I271 §9.4).
   *
   * Sent alongside `role` and `is_premium`, not instead of them, because `POST /users` is not the
   * endpoint plan §9.2 converts: `setUserRole` is. The client derives the legacy pair from this and
   * follows the create with a role write when, and only when, the pair cannot express the tier,
   * which is every eXp tier, by construction. See `UserApiClient.createUser`.
   */
  role_v2?: string
  whitelabel_id?: number
  // Team fields
  team_id?: number
  // Password reset fields
  reset_token?: string
  reset_created?: string
}

/**
 * Update user request. Mirrors the main API's wire contract: is_premium and
 * active are accepted as 0|1 (preferred) or boolean (legacy callers). The
 * client coerces booleans to 0|1 before sending.
 */
export interface UpdateUserRequest {
  email?: string
  name?: string
  first_name?: string
  last_name?: string
  phone?: string
  active?: boolean | 0 | 1
  is_premium?: boolean | 0 | 1
  role?: string
  /**
   * The role to move the user to, in the unified vocabulary (plan CO-I271 §9.4).
   *
   * **Not a field on the generic user update, even though it appears as one here.** The main API
   * strips `role_v2` from `PUT /users/:id` unconditionally, by design: a role is not profile data
   * and it is derived from `role` and the tier bits on that path (plan Decision 23). So the client
   * splits a request carrying this key, the role goes to `PUT /users/:id/role`, the rest goes to
   * the generic update. Call sites state what they mean and the transport is decided in one place.
   *
   * Sending this **instead of** `role` + `is_premium` is the point of §9.4. The legacy pair cannot
   * express a move from `AGENT_EXP_PRO` to `AGENT_EXP_ELITE`, both are `AGENT` + `is_premium 1`,
   * and the main API's derivation guard, which exists to stop unrelated legacy writes demoting a
   * paying agent, correctly refuses to act on a pair that says nothing new.
   */
  role_v2?: string
  team_id?: number
  whitelabel_id?: number
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
