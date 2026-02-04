/**
 * Card-related DTOs (Data Transfer Objects)
 * These types define the inputs and outputs for card use cases
 */

/**
 * Input for getting a user's card
 */
export interface GetUserCardInput {
  userId: number
}

/**
 * Card data returned from repository
 */
export interface CardData {
  id: number
  user_id: number | null
  card_id: string
  last_4: string
  card_brand: string
  exp_month: string
  exp_year: string
  cardholder_name: string
  square_customer_id: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Output from getting a user's card
 */
export interface GetUserCardOutput {
  id: number
  userId: number | null
  cardId: string
  last4: string
  cardBrand: string
  expMonth: string
  expYear: string
  cardholderName: string
  squareCustomerId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Input for checking if user has a card (card info)
 */
export interface CheckUserCardInfoInput {
  userId: number
}

/**
 * Output from checking user card info
 */
export interface CheckUserCardInfoOutput {
  hasCard: boolean
  card?: CardData
}
