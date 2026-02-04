/**
 * Property-related DTOs (Data Transfer Objects)
 * These types define the inputs and outputs for property use cases
 */

/**
 * Input for unlocking a property
 */
export interface UnlockPropertyInput {
  propertyToken: string
  cardToken: string // Ephemeral token from Square
  userId: number
  email: string
}

/**
 * Output from unlocking a property
 */
export interface UnlockPropertyOutput {
  propertyToken: string
  propertyAddress: string
  transactionId: string
  squarePaymentId: string
  amount: number // 5000 cents = $50
  unlocked: true
}
