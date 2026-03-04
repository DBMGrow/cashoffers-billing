"use client"

import { Card, CardBody } from "@/components/Theme/Card"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import Link from "next/link"
import { useProducts } from "@/providers/ProductProvider"

interface PricingProps {
  whitelabel: string
  investor?: boolean
}

interface ProductCardProps {
  product: any
  whitelabel: string
}

function ProductCard({ product, whitelabel = "iop" }: ProductCardProps) {
  const signupFeeAmount = (product.price || 0) / 100
  const monthlyPrice = (product.data?.renewal_cost || 0) / 100
  const hasSignupFee = signupFeeAmount > 0

  return (
    <Card className="w-full">
      <CardBody className="flex flex-col gap-3 justify-between">
        <h3 className="text-center">{product.product_name}</h3>
        <div>
          <div className="flex justify-center text-price items-end">
            ${monthlyPrice}
            <span className="text-caption pb-0.75">/mo</span>
          </div>
          {hasSignupFee && signupFeeAmount > 0 && (
            <div className="flex justify-center text-caption">+${signupFeeAmount} signup fee</div>
          )}
        </div>
        <div className="flex flex-col grow gap-2 text-sm">
          <div className="p-2 bg-gray-100 grow border border-gray-300 rounded">
            <p>{product.product_description || "Premium subscription plan"}</p>
          </div>
        </div>
        <Link className="w-full flex flex-col" href={`/${whitelabel}/subscribe/${product.product_id}`}>
          <ThemeButton color="primary">Sign Up</ThemeButton>
        </Link>
      </CardBody>
    </Card>
  )
}

export default function Pricing({ whitelabel, investor = false }: PricingProps) {
  const { products: allProducts, loading } = useProducts({
    mode: "signup",
    whitelabel: whitelabel || "default",
  })

  if (loading) {
    return <div className="grow flex justify-center items-center">Loading...</div>
  }

  // Filter products based on role and visibility
  const visibleProducts = allProducts.filter((product) => {
    // Hide inactive products
    if (product.product_type === "none") return false

    // Filter by role
    const productRole = product.data?.user_config?.role
    if (investor) {
      return productRole === "INVESTOR"
    }
    return productRole !== "INVESTOR"
  })

  let prods = visibleProducts

  if (whitelabel === "platinum") {
    prods = visibleProducts.slice(0, 1)

    return (
      <div className="grow flex justify-center gap-2 pb-17.5">
        {prods.map((product) => (
          <ProductCard key={product.product_id} product={product} whitelabel={whitelabel} />
        ))}
      </div>
    )
  }

  if (investor) {
    return (
      <div className="grow flex justify-center gap-2 pb-17.5">
        {prods.map((product) => (
          <ProductCard key={product.product_id} product={product} whitelabel={whitelabel} />
        ))}
      </div>
    )
  }

  return (
    <div className="grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pb-17.5">
      {prods.map((product) => (
        <ProductCard key={product.product_id} product={product} whitelabel={whitelabel} />
      ))}
    </div>
  )
}
