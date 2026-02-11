/**
 * Check if a user has all the required permissions
 * @param tokenOwner - The token owner object with capabilities
 * @param permissions - Array of required permissions
 * @returns true if user has all permissions, false otherwise
 */
export function userCan(
  tokenOwner: { capabilities?: string[] } | undefined,
  ...permissions: string[]
): boolean {
  if (!tokenOwner?.capabilities) {
    return false
  }

  return permissions.every((permission) => tokenOwner.capabilities?.includes(permission))
}

/**
 * Legacy compatibility wrapper for Express-style request objects
 * @deprecated Use userCan directly with tokenOwner object
 */
export default function userCanLegacy(
  req: { token_owner?: { capabilities?: string[] } },
  ...permissions: string[]
): boolean {
  return userCan(req.token_owner, ...permissions)
}
