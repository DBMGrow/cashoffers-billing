/**
 * Product-related DTOs (Data Transfer Objects)
 * These types define the inputs and outputs for product use cases
 */

/**
 * Input for creating a product
 */
export interface CreateProductInput {
  productName: string
  productDescription?: string
  productType: "none" | "one-time" | "subscription"
  productCategory: "premium_cashoffers" | "external_cashoffers" | "homeuptick_only"
  price: number // in cents
  data?: Record<string, any>
}

/**
 * Output from creating a product
 */
export interface CreateProductOutput {
  productId: number
  productName: string
  productType: string
  price: number
}
