"use client"

import SubscribeFlow from "@/components/forms/subscribe/SubscribeFlow"
import { useSearchParams } from "next/navigation"

export default function SubscribePageClient() {
  const searchParams = useSearchParams()
  const whitelabel = (searchParams.get("w") || "default") as any
  const coupon = searchParams.get("coupon")
  const mockPurchase = searchParams.get("mock_purchase") === "true"

  const product = searchParams.get("product")

  const productNumber = product === "free" ? "free" : product === "freeinvestor" ? "freeinvestor" : Number(product) || 0
  return (
    <>
      <SubscribeFlow
        initialProduct={productNumber}
        whitelabel={whitelabel}
        coupon={coupon}
        mockPurchase={mockPurchase}
      />
    </>
  )
}
