/**
 * Full-name validation for signup.
 *
 * Signups collect a single free-text "name" field which downstream code splits
 * on whitespace into first/last name. A name without a space yields an empty
 * last name, so we require at least a first and last name (two whitespace-
 * separated, non-empty parts).
 */
export const FULL_NAME_REQUIRED_MESSAGE = "Please enter your first and last name"

export function isFullName(name: string | null | undefined): boolean {
  if (!name) return false
  return name.trim().split(/\s+/).filter(Boolean).length >= 2
}
