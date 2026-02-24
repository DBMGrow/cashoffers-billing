"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { ProductData } from "@/api/domain/types/product-data.types"

/**
 * Product type matching the database schema
 */
export interface Product {
  product_id: number
  product_name: string
  product_description: string | null
  product_type: "none" | "one-time" | "subscription"
  price: number
  data: ProductData | null
  createdAt: Date
  updatedAt: Date
}

interface ProductContextType {
  products: Product[]
  loading: boolean
  error: string | null
  getProductById: (id: number | string) => Product | undefined
  refetch: () => void
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

interface ProductProviderProps {
  children: ReactNode
  whitelabel?: string
  mode: "signup" | "manage"
}

export function ProductProvider({
  children,
  whitelabel,
  mode,
}: ProductProviderProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)

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
        setProducts(data.data)
      } else {
        throw new Error(data.error || "Failed to load products")
      }
    } catch (err) {
      console.error("Error fetching products:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [whitelabel, mode])

  const getProductById = (id: number | string): Product | undefined => {
    const numId = typeof id === "string" ? parseInt(id, 10) : id
    return products.find((p) => p.product_id === numId)
  }

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        error,
        getProductById,
        refetch: fetchProducts,
      }}
    >
      {children}
    </ProductContext.Provider>
  )
}

export const useProducts = () => {
  const context = useContext(ProductContext)
  if (context === undefined) {
    throw new Error("useProducts must be used within a ProductProvider")
  }
  return context
}
