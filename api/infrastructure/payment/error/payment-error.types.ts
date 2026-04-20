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
  INVALID_CARD_DATA = "INVALID_CARD_DATA",
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
 * Structured error thrown by the Square payment provider.
 * Carries the primary Square error code as a typed property so
 * upstream callers can route on it without parsing the message string.
 */
export class SquareApiError extends Error {
  constructor(
    message: string,
    public readonly squareCode: string,
    public readonly squareErrors: Array<{ code: string; detail: string; category?: string }>
  ) {
    super(message)
    this.name = "SquareApiError"
  }
}

/**
 * Square error codes that represent a *platform* problem — invalid credentials,
 * disabled application, service outages. These will keep failing until a
 * developer fixes something on our side, so they must page the developer.
 *
 * Codes that surface as a declined-payment to the end user (CARD_DECLINED,
 * CVV_FAILURE, TRANSACTION_LIMIT, etc.) are NOT in this list — those flow
 * through the normal "payment failed" email path with a friendly message.
 *
 * See https://developer.squareup.com/reference/square/enums/ErrorCode
 */
const CRITICAL_SQUARE_CODES = new Set<string>([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INSUFFICIENT_SCOPES",
  "INVALID_TOKEN",
  "EXPIRED_TOKEN",
  "INVALID_LOCATION",
  "LOCATION_NOT_ACTIVATED",
  "APPLICATION_DISABLED",
  "ACCOUNT_UNUSABLE",
  "MERCHANT_SUBSCRIPTION_NOT_FOUND",
  "INTERNAL_SERVER_ERROR",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
])

/**
 * True when the Square error is a platform/auth/outage problem that requires
 * developer intervention and will keep failing until resolved. Card-level
 * declines (including seller-account TRANSACTION_LIMIT) are NOT critical —
 * those are handled as user-facing payment failures with a friendly message.
 */
export function isCriticalSquareError(error: unknown): error is SquareApiError {
  if (!(error instanceof SquareApiError)) return false
  if (CRITICAL_SQUARE_CODES.has(error.squareCode)) return true
  return error.squareErrors.some((e) => e.code && CRITICAL_SQUARE_CODES.has(e.code))
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
