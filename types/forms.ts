export interface SubscribeFormData {
  product: number | string
  email: string
  name: string
  phone: string
  slug: string | null
  name_broker: string | null
  name_team: string | null
  coupon: string | null
  whitelabel: string | null
  isInvestor: boolean
  cardData: CardData | null
}

export interface CardData {
  token: string
  details: {
    card: {
      expMonth: number
      expYear: number
      brand: string
      lastFourDigits: string
    }
  }
}

export interface ManageFormData {
  email: string
  password: string
}

export type FormStep =
  | "plan"
  | "email"
  | "name"
  | "slug"
  | "broker"
  | "team"
  | "phone"
  | "card"
  | "review"
  | "welcome"
  | "error"
  | "offerDowngrade"
  | "offerDowngradeConfirm"

export type WhitelabelType =
  | "default"
  | "kw"
  | "yhs"
  | "uco"
  | "eco"
  | "mop"
  | "platinum"
