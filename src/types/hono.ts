/**
 * Hono context variable types
 * Define types for c.get() and c.set() to enable TypeScript inference
 */

import type { PaymentContext } from '@/config/config.interface'

export type HonoVariables = {
  user: any // User data from auth middleware
  token_owner: any // Token owner data from auth middleware
  requestId: string // Request ID from digest middleware
  paymentContext: PaymentContext // Payment context with test mode detection
}
