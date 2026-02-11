import { PaymentError } from "./payment-error.types"

/**
 * Payment Error Translator Interface
 *
 * Translates payment provider error codes into user-friendly,
 * actionable error messages with recovery suggestions.
 */
export interface IPaymentErrorTranslator {
  /**
   * Translate a payment provider error into a user-friendly error
   *
   * @param error Error from payment provider (Square API error object)
   * @returns Translated payment error with user-friendly messages
   *
   * @example
   * ```typescript
   * const translatedError = translator.translate(squareError)
   * console.log(translatedError.message) // "Your card was declined"
   * console.log(translatedError.suggestions) // ["Try a different payment method", ...]
   * ```
   */
  translate(error: any): PaymentError

  /**
   * Translate an error code directly
   *
   * @param errorCode Error code from payment provider
   * @returns Translated payment error
   */
  translateCode(errorCode: string): PaymentError
}
