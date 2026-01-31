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

/**
 * Input for refunding a payment
 */
export interface RefundPaymentInput {
  userId: number
  squareTransactionId: string
  email?: string // Optional, will fetch from user API if not provided
}

/**
 * Output from refunding a payment
 */
export interface RefundPaymentOutput {
  refundId: string
  amount: number
  status: "completed" | "pending"
  originalTransactionId: string
}

/**
 * Input for getting payments
 */
export interface GetPaymentsInput {
  userId?: number // Optional - if not provided and readAll permission, gets all
  page?: number
  limit?: number
  readAll?: boolean // Whether user has read_all permission
}

/**
 * Output from getting payments
 */
export interface GetPaymentsOutput {
  payments: Array<{
    id: number
    userId: number
    amount: number
    type: string
    memo: string
    status: string
    createdAt: Date
    squareTransactionId?: string
  }>
  total: number
  page: number
  limit: number
}
