import square from "@/config/square"
import { v4 as uuid } from "uuid"
import { CreatePaymentResponse, Currency, ErrorCategory } from "square"
import { emitEvent } from "@/lib/eventBus"
import { Req, Res } from "@/lib/types"
import { db } from "@/lib/database"
import sendAlert from "@/lib/sendAlert"

export interface ChargeCustomerData {
  user_id: number
  items: ChargeCardData["items"]
}

export interface ChargeCardData {
  user_id: number
  card_token: string
  customerId?: string
  amount: number
  currency?: Currency
  items?: {
    name: string
    description?: string
    amount: number
    quantity?: number
  }[]
}

/**
 * Payments class to abstract payment processing logic.
 * Handles the core operations related to payments.
 */
export default class Payments {
  req: Req
  res: Res

  constructor(req: Req, res: Res) {
    this.req = req
    this.res = res
  }

  async chargeCustomer(data: ChargeCustomerData) {
    const userCard = await this.getUserCard(data.user_id)
    if (!userCard) {
      throw new Error("No card on file for user")
    }

    const totalAmount = this.calculateTotalAmount(data.items)

    return this.chargeCard({
      user_id: data.user_id,
      card_token: userCard.card_id,
      customerId: userCard.square_customer_id,
      amount: totalAmount,
      currency: "USD",
    })
  }

  private async chargeCard(data: ChargeCardData) {
    const { card_token, customerId, items, amount, currency = "USD" } = data
    const idempotencyKey = uuid()

    const chargeNote = this.getChargeNote(items)

    const response = await square.payments.create({
      sourceId: card_token,
      idempotencyKey,
      customerId,
      autocomplete: true,
      acceptPartialAuthorization: false,
      note: chargeNote,
      amountMoney: {
        amount: BigInt(amount),
        currency,
      },
    })

    emitEvent({
      name: "payments.card_charge_attempted",
      payload: { request: data, response },
      payload_version: "1.0.0",
      req: this.req,
      res: this.res,
    })

    return response
  }

  private async getUserCard(user_id: number) {
    const userCard = await db.selectFrom("UserCards").selectAll().where("user_id", "=", user_id).executeTakeFirst()

    return userCard
  }

  private calculateTotalAmount(items: ChargeCardData["items"]) {
    if (!items || items.length === 0) {
      return 0
    }

    return items.reduce((total, item) => {
      const quantity = item.quantity ?? 1
      return total + item.amount * quantity
    }, 0)
  }

  private getChargeNote(items: ChargeCardData["items"]) {
    const totalAmount = this.calculateTotalAmount(items)
    if (!totalAmount || !items || items.length === 0) {
      return `No Charge`
    }

    return items.map((item) => item.name).join(", ")
  }

  async logTransaction(data: { request: ChargeCardData; response: CreatePaymentResponse }) {
    await db
      .insertInto("Transactions")
      .values({
        user_id: data.request.user_id,
        amount: data.request.amount,
        memo: this.getChargeNote(data.request.items),
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "payment",
        status: data.response.payment ? "successful" : "failed",
        square_transaction_id: data.response.payment ? data.response.payment.id : null,
        data: JSON.stringify(data),
      })
      .execute()
  }

  private isError(response: CreatePaymentResponse) {
    if (!response.errors || response.errors.length === 0) {
      return false
    }

    return true
  }

  private getDeveloperErrors(response: CreatePaymentResponse) {
    if (!response.errors || response.errors.length === 0) {
      return false
    }

    const developErrorCategories: ErrorCategory[] = [
      "API_ERROR",
      "AUTHENTICATION_ERROR",
      "EXTERNAL_VENDOR_ERROR",
      "INVALID_REQUEST_ERROR",
      "MERCHANT_SUBSCRIPTION_ERROR",
      "RATE_LIMIT_ERROR",
      "REFUND_ERROR",
    ]

    return response.errors.filter((error) => developErrorCategories.includes(error.category))
  }

  private getUserErrors(response: CreatePaymentResponse) {
    if (!response.errors || response.errors.length === 0) {
      return false
    }

    const userErrorCategories: ErrorCategory[] = ["PAYMENT_METHOD_ERROR"]

    return response.errors.filter((error) => userErrorCategories.includes(error.category))
  }

  private getUserErrorMessages(response: CreatePaymentResponse) {
    const userErrors = this.getUserErrors(response)
    if (!userErrors || userErrors.length === 0) {
      return []
    }

    return userErrors.map((error) => {
      switch (error.code) {
        case "ADDRESS_VERIFICATION_FAILURE":
          return "The card issuer declined the request because the postal code is invalid."
        case "CARDHOLDER_INSUFFICIENT_PERMISSIONS":
          return "The card issuer declined the request due to restrictions on where the card can be used. If the card is a gift card, it may be restricted to specific merchants. Please use a different payment method."
        case "CARD_EXPIRED":
          return "The card issuer declined the request because the card is expired. Please use a different payment method."
        case "CARD_NOT_SUPPORTED":
          return "This card is not supported either in the geographic region or by the marchant category code. Please use a different payment method."
        case "CARD_TOKEN_EXPIRED":
          return "The card token used for this payement has expired. Please try again."
        case "CARD_TOKEN_USED":
          return "The card token used for this payment has already been used. Please try again."

        case "CVV_FAILURE":
          return "The card issuer declined the request because the CVV code is invalid."

        case "EXPIRATION_FAILURE":
          return "The card expiration date is either invalid or expired. Please use a different payment method."

        case "GENERIC_DECLINE":
          return "The card issuer declined the request. If the payment information seems correct, please contact your card issuer for more information."

        case "INSUFFICIENT_FUNDS":
          return "The funding source for the card does not have sufficient funds to complete the transaction. Please use a different payment method or increase the funds available."

        case "INVALID_ACCOUNT":
          return "The card issuer declined the request because the account information is invalid. Please use a different payment method."

        case "INVALID_CARD":
          return "The card provided is not a valid credit or debit card. Please use a different payment method."

        case "INVALID_CARD_DATA":
          return "The card information provided is invalid. Please check the card details and try again."

        case "INVALID_EMAIL_ADDRESS":
          return "The email address provided is invalid. Please check the email address and try again."

        case "INVALID_EXPIRATION":
          return "The card expiration date provided is invalid. Please check the expiration date and try again."

        case "INVALID_LOCATION":
          return "The location information provided is invalid. Please check the location details and try again."

        case "INVALID_PHONE_NUMBER":
          return "The phone number provided is invalid. Please check the phone number and try again."

        case "INVALID_PIN":
          return "The PIN provided is invalid. Please check the PIN and try again."

        case "INVALID_POSTAL_CODE":
          return "The postal code provided is invalid. Please check the postal code and try again."

        default:
          "An error occurred while processing your payment. Please try again or use a different payment method."
      }
    })
  }

  async alertDeveloperOnFailure(data: { request: ChargeCardData; response: CreatePaymentResponse }) {
    const developerErrors = this.getDeveloperErrors(data.response)
    if (!developerErrors || developerErrors.length === 0) {
      return
    }

    const messageLines = developerErrors.map(
      (error) => `- ${error.category}: ${error.code} - ${error.detail} - ${error.field ?? ""}`
    )

    await sendAlert(`Payment Processing Error: ${messageLines.join("\n")}`)
  }

  async emailUserOnFailure(data: { request: ChargeCardData; response: CreatePaymentResponse }) {
    const userErrors = this.getUserErrors(data.response)
    if (!userErrors || userErrors.length === 0) {
      return
    }

    const userErrorMessages = this.getUserErrorMessages(data.response)

    // Implement email logic here
  }

  async emailUserOnSuccess(data: { request: ChargeCardData; response: CreatePaymentResponse }) {
    const isError = this.isError(data.response)
    if (isError) {
      return
    }

    // Implement email logic here
  }
}
