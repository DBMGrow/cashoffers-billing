/**
 * Payment Error Types and Categories
 *
 * Categorizes payment failures into actionable groups
 * Based on Square API error codes and categories
 */

/**
 * Payment error categories for high-level grouping
 */
export enum PaymentErrorCategory {
  CARD_DECLINED = "CARD_DECLINED",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  CARD_EXPIRED = "CARD_EXPIRED",
  INVALID_CARD = "INVALID_CARD",
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  UNKNOWN = "UNKNOWN",
}

/**
 * Common Square error codes
 * See: https://developer.squareup.com/docs/payments-api/error-codes
 */
export enum SquareErrorCode {
  // Card declined
  CARD_DECLINED = "CARD_DECLINED",
  CVV_FAILURE = "CVV_FAILURE",
  ADDRESS_VERIFICATION_FAILURE = "ADDRESS_VERIFICATION_FAILURE",

  // Insufficient funds
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",

  // Card issues
  EXPIRED_CARD = "EXPIRED_CARD",
  INVALID_CARD = "INVALID_CARD",
  INVALID_EXPIRATION = "INVALID_EXPIRATION",
  CARD_NOT_SUPPORTED = "CARD_NOT_SUPPORTED",

  // Authentication
  CARDHOLDER_INSUFFICIENT_PERMISSIONS = "CARDHOLDER_INSUFFICIENT_PERMISSIONS",
  PAN_FAILURE = "PAN_FAILURE",

  // Technical errors
  GENERIC_DECLINE = "GENERIC_DECLINE",
  TEMPORARY_ERROR = "TEMPORARY_ERROR",
  RATE_LIMITED = "RATE_LIMITED",

  // Configuration
  INVALID_ACCOUNT = "INVALID_ACCOUNT",
  BAD_REQUEST = "BAD_REQUEST",
}

/**
 * Translated payment error with user-friendly information
 */
export interface PaymentError {
  /** Original error code from payment provider */
  code: string

  /** Error category for grouping */
  category: PaymentErrorCategory

  /** User-friendly error title */
  title: string

  /** User-friendly error message */
  message: string

  /** Actionable suggestions for the user */
  suggestions: string[]

  /** Developer/support message with technical details */
  developerMessage: string

  /** Whether the payment can be retried */
  retryable: boolean

  /** Whether the user should contact support */
  contactSupport: boolean
}

/**
 * Recovery suggestions for common error scenarios
 */
export const RecoverySuggestions = {
  CARD_DECLINED: [
    "Try a different payment method",
    "Contact your bank to authorize the transaction",
    "Verify your card details are correct",
  ],
  INSUFFICIENT_FUNDS: [
    "Add funds to your account",
    "Try a different payment method",
    "Contact your bank for assistance",
  ],
  CARD_EXPIRED: [
    "Update your card expiration date",
    "Add a new payment method",
  ],
  INVALID_CARD: [
    "Check that your card number is correct",
    "Verify the CVV code",
    "Try a different payment method",
  ],
  CVV_FAILURE: [
    "Verify the CVV security code on the back of your card",
    "Check that you entered the correct 3 or 4-digit code",
  ],
  GENERIC: [
    "Try again in a few moments",
    "Try a different payment method",
    "Contact support if the problem persists",
  ],
} as const
