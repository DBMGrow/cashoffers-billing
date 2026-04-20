import { IPaymentErrorTranslator } from "./payment-error-translator.interface"
import {
  PaymentError,
  PaymentErrorCategory,
  SquareErrorCode,
  RecoverySuggestions,
} from "./payment-error.types"

/**
 * Square Payment Error Translator
 *
 * Translates Square API error codes into user-friendly messages
 * with actionable recovery suggestions.
 */
export class SquareErrorTranslator implements IPaymentErrorTranslator {
  /**
   * Error code to category mapping
   */
  private readonly categoryMap: Record<string, PaymentErrorCategory> = {
    // Card declined
    CARD_DECLINED: PaymentErrorCategory.CARD_DECLINED,
    CVV_FAILURE: PaymentErrorCategory.CARD_DECLINED,
    ADDRESS_VERIFICATION_FAILURE: PaymentErrorCategory.CARD_DECLINED,
    GENERIC_DECLINE: PaymentErrorCategory.CARD_DECLINED,
    TRANSACTION_LIMIT: PaymentErrorCategory.CARD_DECLINED,
    CARD_DECLINED_CALL_ISSUER: PaymentErrorCategory.CARD_DECLINED,
    CARD_DECLINED_VERIFICATION_REQUIRED: PaymentErrorCategory.CARD_DECLINED,
    CHIP_INSERTION_REQUIRED: PaymentErrorCategory.CARD_DECLINED,
    VOICE_FAILURE: PaymentErrorCategory.CARD_DECLINED,

    // Insufficient funds
    INSUFFICIENT_FUNDS: PaymentErrorCategory.INSUFFICIENT_FUNDS,

    // Card expired
    EXPIRED_CARD: PaymentErrorCategory.CARD_EXPIRED,

    // Invalid card
    INVALID_CARD: PaymentErrorCategory.INVALID_CARD,
    INVALID_EXPIRATION: PaymentErrorCategory.INVALID_CARD,
    CARD_NOT_SUPPORTED: PaymentErrorCategory.INVALID_CARD,
    PAN_FAILURE: PaymentErrorCategory.INVALID_CARD,

    // Authentication
    CARDHOLDER_INSUFFICIENT_PERMISSIONS: PaymentErrorCategory.AUTHENTICATION_REQUIRED,

    // Network/temporary
    TEMPORARY_ERROR: PaymentErrorCategory.NETWORK_ERROR,

    // Rate limiting
    RATE_LIMITED: PaymentErrorCategory.RATE_LIMIT,

    // Configuration
    INVALID_ACCOUNT: PaymentErrorCategory.CONFIGURATION_ERROR,
    BAD_REQUEST: PaymentErrorCategory.CONFIGURATION_ERROR,
  }

  /**
   * Error code to user-friendly message mapping
   */
  private readonly messageMap: Record<string, { title: string; message: string }> = {
    CARD_DECLINED: {
      title: "Card Declined",
      message:
        "Your card was declined by your bank. This could be due to insufficient funds, security restrictions, or other issues.",
    },
    CVV_FAILURE: {
      title: "Security Code Invalid",
      message:
        "The CVV security code you entered doesn't match your card. Please check the 3 or 4-digit code on the back of your card.",
    },
    ADDRESS_VERIFICATION_FAILURE: {
      title: "Address Verification Failed",
      message:
        "The billing address you provided doesn't match your bank's records. Please verify your address is correct.",
    },
    INSUFFICIENT_FUNDS: {
      title: "Insufficient Funds",
      message:
        "Your card doesn't have enough funds to complete this purchase. Please add funds or use a different payment method.",
    },
    EXPIRED_CARD: {
      title: "Card Expired",
      message: "Your card has expired. Please update your payment method with a valid expiration date.",
    },
    INVALID_CARD: {
      title: "Invalid Card",
      message: "The card number you entered is invalid. Please check your card details and try again.",
    },
    INVALID_EXPIRATION: {
      title: "Invalid Expiration Date",
      message: "The expiration date you entered is invalid. Please check your card's expiration date.",
    },
    CARD_NOT_SUPPORTED: {
      title: "Card Not Supported",
      message: "This type of card is not supported. Please try a different payment method.",
    },
    CARDHOLDER_INSUFFICIENT_PERMISSIONS: {
      title: "Card Blocked",
      message: "Your card issuer has blocked this transaction. Please contact your bank for assistance.",
    },
    PAN_FAILURE: {
      title: "Card Number Invalid",
      message: "The card number you entered is invalid. Please verify your card number and try again.",
    },
    GENERIC_DECLINE: {
      title: "Payment Declined",
      message: "Your payment was declined. Please contact your bank or try a different payment method.",
    },
    TRANSACTION_LIMIT: {
      title: "Payment Declined",
      message:
        "Your payment was declined because the transaction exceeds an allowable limit. Please contact your bank to authorize the charge, or try a different card.",
    },
    CARD_DECLINED_CALL_ISSUER: {
      title: "Contact Your Bank",
      message:
        "Your payment was declined by your bank. Please contact your card issuer to authorize this transaction, then try again.",
    },
    CARD_DECLINED_VERIFICATION_REQUIRED: {
      title: "Verification Required",
      message:
        "Your bank requires additional verification for this transaction. Please contact your card issuer, then try again.",
    },
    VOICE_FAILURE: {
      title: "Payment Declined",
      message:
        "Your bank declined this transaction. Please contact your card issuer or try a different payment method.",
    },
    TEMPORARY_ERROR: {
      title: "Temporary Error",
      message: "We're experiencing a temporary issue processing payments. Please try again in a few moments.",
    },
    RATE_LIMITED: {
      title: "Too Many Attempts",
      message: "Too many payment attempts. Please wait a few minutes before trying again.",
    },
    INVALID_ACCOUNT: {
      title: "Configuration Error",
      message: "There's an issue with our payment configuration. Please contact support.",
    },
    BAD_REQUEST: {
      title: "Invalid Request",
      message: "There was an error processing your payment. Please try again or contact support.",
    },
  }

  translate(error: any): PaymentError {
    // Extract error code from Square error object
    const errorCode = this.extractErrorCode(error)
    return this.translateCode(errorCode)
  }

  translateCode(errorCode: string): PaymentError {
    const category = this.categoryMap[errorCode] || PaymentErrorCategory.UNKNOWN
    const messages =
      this.messageMap[errorCode] || {
        title: "Payment Failed",
        message: "We couldn't process your payment. Please try again or contact support.",
      }

    const suggestions = this.getSuggestions(category, errorCode)
    const retryable = this.isRetryable(category)
    const contactSupport = this.shouldContactSupport(category)

    return {
      code: errorCode,
      category,
      title: messages.title,
      message: messages.message,
      suggestions,
      developerMessage: `Square API error: ${errorCode} - ${category}`,
      retryable,
      contactSupport,
    }
  }

  /**
   * Extract error code from Square error response
   */
  private extractErrorCode(error: any): string {
    // Square errors can come in various formats
    if (typeof error === "string") {
      return error
    }

    // Square API v2 error format
    if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      return error.errors[0].code || "UNKNOWN"
    }

    // Direct error object
    if (error?.code) {
      return error.code
    }

    // Error detail
    if (error?.detail) {
      return error.detail
    }

    return "UNKNOWN"
  }

  /**
   * Get recovery suggestions based on error category
   */
  private getSuggestions(category: PaymentErrorCategory, errorCode: string): string[] {
    switch (category) {
      case PaymentErrorCategory.CARD_DECLINED:
        if (errorCode === "CVV_FAILURE") {
          return [...RecoverySuggestions.CVV_FAILURE]
        }
        return [...RecoverySuggestions.CARD_DECLINED]

      case PaymentErrorCategory.INSUFFICIENT_FUNDS:
        return [...RecoverySuggestions.INSUFFICIENT_FUNDS]

      case PaymentErrorCategory.CARD_EXPIRED:
        return [...RecoverySuggestions.CARD_EXPIRED]

      case PaymentErrorCategory.INVALID_CARD:
        return [...RecoverySuggestions.INVALID_CARD]

      default:
        return [...RecoverySuggestions.GENERIC]
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(category: PaymentErrorCategory): boolean {
    switch (category) {
      case PaymentErrorCategory.NETWORK_ERROR:
      case PaymentErrorCategory.RATE_LIMIT:
        return true

      case PaymentErrorCategory.CARD_DECLINED:
      case PaymentErrorCategory.INSUFFICIENT_FUNDS:
      case PaymentErrorCategory.CARD_EXPIRED:
      case PaymentErrorCategory.INVALID_CARD:
      case PaymentErrorCategory.AUTHENTICATION_REQUIRED:
        return false

      default:
        return false
    }
  }

  /**
   * Determine if user should contact support
   */
  private shouldContactSupport(category: PaymentErrorCategory): boolean {
    switch (category) {
      case PaymentErrorCategory.CONFIGURATION_ERROR:
      case PaymentErrorCategory.UNKNOWN:
        return true

      default:
        return false
    }
  }
}

/**
 * Create a Square error translator instance
 */
export const createSquareErrorTranslator = (): IPaymentErrorTranslator => {
  return new SquareErrorTranslator()
}
