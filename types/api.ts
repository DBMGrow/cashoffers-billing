export interface ApiResponse<T = any> {
  success: "success" | "error" | "warning"
  data?: T
  error?: string
  code?: string
  message?: string
}

export interface User {
  email: string
  name: string
  phone: string
  password?: string
  api_token: string
  user_id: number
  is_premium: boolean
  has_subscription: boolean
  role: string
  whitelabel_id: number
  reset_token?: string
  slug?: string
}

export interface Subscription {
  subscription_name: string
  renewal_cost: number
  duration?: string
  createdAt?: string
  renewal_date?: string
  status?: string
  data: {
    renewal_cost: number
    team_members?: number
    [key: string]: any
  }
}

export interface PurchaseRequest {
  product_id: number | string
  email: string
  phone: string
  name: string
  card_token: string
  exp_month: number
  exp_year: number
  cardholder_name: string
  name_broker?: string | null
  name_team?: string | null
  whitelabel?: string | null
  slug?: string | null
  isInvestor: boolean
  api_token?: string | null
  url?: string
  coupon?: string | null
}

export interface PurchaseFreeRequest {
  email: string
  phone: string
  name: string
  name_broker?: string | null
  name_team?: string | null
  whitelabel?: string | null
  isInvestor: number
  slug?: string | null
}
