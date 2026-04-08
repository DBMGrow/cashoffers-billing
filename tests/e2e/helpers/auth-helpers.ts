import { Page } from '@playwright/test'
import jwt from 'jsonwebtoken'

/**
 * Generate a test JWT token for authentication
 */
export function generateTestJWT(payload: { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET || 'test-secret'
  return jwt.sign(payload, secret, { expiresIn: '24h' })
}

/**
 * Set authentication cookie directly
 */
export async function setAuthCookie(page: Page, apiToken: string) {
  await page.context().addCookies([
    {
      name: '_api_token',
      value: apiToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Login via token and verify cookie is set
 */
export async function loginWithToken(page: Page, token: string) {
  await page.goto(`/manage?t=${token}`)

  // Wait for token verification
  await page.waitForLoadState('networkidle')

  // Verify cookie was set
  const cookies = await page.context().cookies()
  const apiTokenCookie = cookies.find(c => c.name === '_api_token')

  return !!apiTokenCookie
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies()
  return cookies.some(c => c.name === '_api_token')
}

/**
 * Clear authentication
 */
export async function logout(page: Page) {
  await page.context().clearCookies()
}
