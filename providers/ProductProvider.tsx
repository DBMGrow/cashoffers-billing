"use client"

import { useQuery } from "@tanstack/react-query"
import { ProductData } from "@/api/domain/types/product-data.types"

/**
 * Product type matching the database schema
 */
export interface Product {
  product_id: number | string
  product_name: string
  product_description: string | null
  product_type: "none" | "one-time" | "subscription"
  product_category?: "premium_cashoffers" | "external_cashoffers" | "homeuptick_only"
  price: number
  active: number
  data: ProductData | null
  createdAt: Date
  updatedAt: Date
}

interface FetchProductsParams {
  mode: "signup" | "manage"
  whitelabel?: string
}

/**
 * Fetches products from the API
 */
async function fetchProducts({ mode, whitelabel }: FetchProductsParams): Promise<Product[]> {
  const endpoint =
    mode === "signup"
      ? `/api/signup/products?whitelabel=${whitelabel || "default"}`
      : `/api/manage/products` // Server-side filtered by user's role

  const response = await fetch(endpoint, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.success === "success" && data.data) {
    return data.data
  }

  throw new Error(data.error || "Failed to load products")
}

/**
 * Hook to fetch and manage products using TanStack Query
 */
/**
 * Returns true if a product has $0 total cost (no signup fee and no renewal cost).
 */
export function isProductFree(product: Product | undefined): boolean {
  if (!product) return false
  const data = product.data
  const renewalCost = data?.renewal_cost ?? product.price ?? 0
  const signupFee = data?.signup_fee ?? product.price ?? 0
  return renewalCost === 0 && signupFee === 0
}

export function useProducts(params: FetchProductsParams) {
  const { data: products = [], isLoading, error, refetch } = useQuery({
    queryKey: ["products", params.mode, params.whitelabel],
    queryFn: () => fetchProducts(params),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  const getProductById = (id: number | string): Product | undefined => {
    const numId = typeof id === "string" ? parseInt(id, 10) : id
    return products.find((p) => p.product_id === numId)
  }

  return {
    products,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    getProductById,
    refetch,
  }
}
