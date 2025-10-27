import { DB } from "./db"
import { Selectable } from "kysely"
import { CreatePaymentResponse } from "square"

export default interface EventPayloads {
  "payments.card_charge_attempted": {
    request: ChargeCardData
    response: CreatePaymentResponse
  }
}
