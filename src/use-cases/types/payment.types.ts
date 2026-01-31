/**
 * Payment-related DTOs (Data Transfer Objects)
 * These types define the inputs and outputs for payment use cases
 */

/**
 * Input for creating a payment
 */
export interface CreatePaymentInput {
  userId: number
  amount: number // in cents
  email: string
  memo?: string
  sendEmailOnCharge?: boolean
}

/**
 * Output from creating a payment
 */
export interface CreatePaymentOutput {
  transactionId: string
  squarePaymentId: string
  amount: number
  status: "completed"
}

/**
 * Input for creating a card
 */
export interface CreateCardInput {
  userId: number | null // null when creating for new user
  cardToken: string
  expMonth: number
  expYear: number
  cardholderName: string
  email: string
  allowNullUserId?: boolean
  sendEmailOnUpdate?: boolean
  attemptRenewal?: boolean
}

/**
 * Output from creating a card
 */
export interface CreateCardOutput {
  cardId: string
  squareCustomerId: string
  last4: string
  cardBrand: string
  expMonth: number
  expYear: number
}
