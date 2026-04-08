/**
 * Generate a random reset token for password reset
 * Format: 16-character alphanumeric uppercase (e.g., QV2TQDK85ER8PGHB)
 */
export function generateResetToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let token = ""
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
