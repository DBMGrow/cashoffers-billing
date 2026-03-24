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
  subscription_id: number
  subscription_name: string
  product_id: number | string
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
  card_token?: string
  exp_month?: number
  exp_year?: number
  cardholder_name: string
  name_broker?: string | null
  name_team?: string | null
  slug?: string | null
  api_token?: string | null
  url?: string
  coupon?: string | null
  mock_purchase?: boolean
}

export interface PurchaseFreeRequest {
  email: string
  phone: string
  name: string
  name_broker?: string | null
  name_team?: string | null
  whitelabel?: string | null
  slug?: string | null
}

export interface Product {
  product_id: number | string
  product_name: string
  product_description?: string | null
  product_type: string
  price: number
  active: number
  data?: {
    renewal_cost?: number
    signup_fee?: number
    duration?: string
    team_members?: number
    user_config?: {
      role?: string
      is_premium?: number
      whitelabel_id?: number | null
      is_team_plan?: boolean
    }
    [key: string]: any
  } | null
  createdAt?: string
  updatedAt?: string
}
