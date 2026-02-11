import { describe, it, expect } from "vitest"
import { SquareErrorTranslator } from "./square-error-translator"
import { PaymentErrorCategory } from "./payment-error.types"

describe("SquareErrorTranslator", () => {
  const translator = new SquareErrorTranslator()

  describe("Card Declined Errors", () => {
    it("should translate CARD_DECLINED error", () => {
      const result = translator.translateCode("CARD_DECLINED")

      expect(result.code).toBe("CARD_DECLINED")
      expect(result.category).toBe(PaymentErrorCategory.CARD_DECLINED)
      expect(result.title).toBe("Card Declined")
      expect(result.message).toContain("declined by your bank")
      expect(result.suggestions).toContain("Try a different payment method")
      expect(result.retryable).toBe(false)
      expect(result.contactSupport).toBe(false)
    })

    it("should translate CVV_FAILURE error", () => {
      const result = translator.translateCode("CVV_FAILURE")

      expect(result.code).toBe("CVV_FAILURE")
      expect(result.category).toBe(PaymentErrorCategory.CARD_DECLINED)
      expect(result.title).toBe("Security Code Invalid")
      expect(result.message).toContain("CVV security code")
      expect(result.suggestions.some((s) => s.includes("CVV"))).toBe(true)
      expect(result.retryable).toBe(false)
    })

    it("should translate GENERIC_DECLINE error", () => {
      const result = translator.translateCode("GENERIC_DECLINE")

      expect(result.code).toBe("GENERIC_DECLINE")
      expect(result.category).toBe(PaymentErrorCategory.CARD_DECLINED)
      expect(result.title).toBe("Payment Declined")
    })
  })

  describe("Insufficient Funds Errors", () => {
    it("should translate INSUFFICIENT_FUNDS error", () => {
      const result = translator.translateCode("INSUFFICIENT_FUNDS")

      expect(result.code).toBe("INSUFFICIENT_FUNDS")
      expect(result.category).toBe(PaymentErrorCategory.INSUFFICIENT_FUNDS)
      expect(result.title).toBe("Insufficient Funds")
      expect(result.message).toContain("doesn't have enough funds")
      expect(result.suggestions).toContain("Add funds to your account")
      expect(result.retryable).toBe(false)
    })
  })

  describe("Card Expired Errors", () => {
    it("should translate EXPIRED_CARD error", () => {
      const result = translator.translateCode("EXPIRED_CARD")

      expect(result.code).toBe("EXPIRED_CARD")
      expect(result.category).toBe(PaymentErrorCategory.CARD_EXPIRED)
      expect(result.title).toBe("Card Expired")
      expect(result.message).toContain("card has expired")
      expect(result.suggestions).toContain("Update your card expiration date")
      expect(result.retryable).toBe(false)
    })
  })

  describe("Invalid Card Errors", () => {
    it("should translate INVALID_CARD error", () => {
      const result = translator.translateCode("INVALID_CARD")

      expect(result.code).toBe("INVALID_CARD")
      expect(result.category).toBe(PaymentErrorCategory.INVALID_CARD)
      expect(result.title).toBe("Invalid Card")
      expect(result.message).toContain("card number you entered is invalid")
      expect(result.suggestions).toContain("Check that your card number is correct")
    })

    it("should translate INVALID_EXPIRATION error", () => {
      const result = translator.translateCode("INVALID_EXPIRATION")

      expect(result.code).toBe("INVALID_EXPIRATION")
      expect(result.category).toBe(PaymentErrorCategory.INVALID_CARD)
      expect(result.title).toBe("Invalid Expiration Date")
    })

    it("should translate CARD_NOT_SUPPORTED error", () => {
      const result = translator.translateCode("CARD_NOT_SUPPORTED")

      expect(result.code).toBe("CARD_NOT_SUPPORTED")
      expect(result.category).toBe(PaymentErrorCategory.INVALID_CARD)
      expect(result.title).toBe("Card Not Supported")
    })

    it("should translate PAN_FAILURE error", () => {
      const result = translator.translateCode("PAN_FAILURE")

      expect(result.code).toBe("PAN_FAILURE")
      expect(result.category).toBe(PaymentErrorCategory.INVALID_CARD)
      expect(result.title).toBe("Card Number Invalid")
    })
  })

  describe("Authentication Errors", () => {
    it("should translate CARDHOLDER_INSUFFICIENT_PERMISSIONS error", () => {
      const result = translator.translateCode("CARDHOLDER_INSUFFICIENT_PERMISSIONS")

      expect(result.code).toBe("CARDHOLDER_INSUFFICIENT_PERMISSIONS")
      expect(result.category).toBe(PaymentErrorCategory.AUTHENTICATION_REQUIRED)
      expect(result.title).toBe("Card Blocked")
      expect(result.message).toContain("card issuer has blocked")
    })
  })

  describe("Network Errors", () => {
    it("should translate TEMPORARY_ERROR error", () => {
      const result = translator.translateCode("TEMPORARY_ERROR")

      expect(result.code).toBe("TEMPORARY_ERROR")
      expect(result.category).toBe(PaymentErrorCategory.NETWORK_ERROR)
      expect(result.title).toBe("Temporary Error")
      expect(result.retryable).toBe(true)
      expect(result.contactSupport).toBe(false)
    })
  })

  describe("Rate Limit Errors", () => {
    it("should translate RATE_LIMITED error", () => {
      const result = translator.translateCode("RATE_LIMITED")

      expect(result.code).toBe("RATE_LIMITED")
      expect(result.category).toBe(PaymentErrorCategory.RATE_LIMIT)
      expect(result.title).toBe("Too Many Attempts")
      expect(result.retryable).toBe(true)
    })
  })

  describe("Configuration Errors", () => {
    it("should translate INVALID_ACCOUNT error", () => {
      const result = translator.translateCode("INVALID_ACCOUNT")

      expect(result.code).toBe("INVALID_ACCOUNT")
      expect(result.category).toBe(PaymentErrorCategory.CONFIGURATION_ERROR)
      expect(result.title).toBe("Configuration Error")
      expect(result.contactSupport).toBe(true)
    })

    it("should translate BAD_REQUEST error", () => {
      const result = translator.translateCode("BAD_REQUEST")

      expect(result.code).toBe("BAD_REQUEST")
      expect(result.category).toBe(PaymentErrorCategory.CONFIGURATION_ERROR)
      expect(result.title).toBe("Invalid Request")
      expect(result.contactSupport).toBe(true)
    })
  })

  describe("Unknown Errors", () => {
    it("should handle unknown error code", () => {
      const result = translator.translateCode("SOME_UNKNOWN_ERROR")

      expect(result.code).toBe("SOME_UNKNOWN_ERROR")
      expect(result.category).toBe(PaymentErrorCategory.UNKNOWN)
      expect(result.title).toBe("Payment Failed")
      expect(result.message).toContain("couldn't process your payment")
      expect(result.suggestions).toContain("Try again in a few moments")
      expect(result.contactSupport).toBe(true)
    })
  })

  describe("Error Object Parsing", () => {
    it("should extract error code from Square API v2 error format", () => {
      const squareError = {
        errors: [
          {
            code: "CARD_DECLINED",
            detail: "Card was declined",
            category: "PAYMENT_METHOD_ERROR",
          },
        ],
      }

      const result = translator.translate(squareError)

      expect(result.code).toBe("CARD_DECLINED")
      expect(result.category).toBe(PaymentErrorCategory.CARD_DECLINED)
    })

    it("should extract error code from error object with code property", () => {
      const error = {
        code: "INSUFFICIENT_FUNDS",
        message: "Insufficient funds",
      }

      const result = translator.translate(error)

      expect(result.code).toBe("INSUFFICIENT_FUNDS")
      expect(result.category).toBe(PaymentErrorCategory.INSUFFICIENT_FUNDS)
    })

    it("should handle string error code", () => {
      const result = translator.translate("EXPIRED_CARD")

      expect(result.code).toBe("EXPIRED_CARD")
      expect(result.category).toBe(PaymentErrorCategory.CARD_EXPIRED)
    })

    it("should handle error with detail property", () => {
      const error = {
        detail: "CVV_FAILURE",
      }

      const result = translator.translate(error)

      expect(result.code).toBe("CVV_FAILURE")
      expect(result.category).toBe(PaymentErrorCategory.CARD_DECLINED)
    })

    it("should handle empty error object", () => {
      const result = translator.translate({})

      expect(result.code).toBe("UNKNOWN")
      expect(result.category).toBe(PaymentErrorCategory.UNKNOWN)
    })
  })

  describe("Developer Messages", () => {
    it("should include developer message with error code and category", () => {
      const result = translator.translateCode("CARD_DECLINED")

      expect(result.developerMessage).toContain("Square API error")
      expect(result.developerMessage).toContain("CARD_DECLINED")
      expect(result.developerMessage).toContain("CARD_DECLINED")
    })
  })

  describe("Recovery Suggestions", () => {
    it("should provide specific suggestions for CVV failure", () => {
      const result = translator.translateCode("CVV_FAILURE")

      expect(result.suggestions.some((s) => s.includes("CVV"))).toBe(true)
    })

    it("should provide generic suggestions for unknown errors", () => {
      const result = translator.translateCode("UNKNOWN_ERROR")

      expect(result.suggestions).toContain("Try again in a few moments")
      expect(result.suggestions).toContain("Contact support if the problem persists")
    })
  })
})
