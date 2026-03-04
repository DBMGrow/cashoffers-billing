"use client"

import SubscribeFlow from "@/components/forms/subscribe/SubscribeFlow"
import { useSearchParams } from "next/navigation"
import { WhitelabelType } from "@/types/forms"
import { WhitelabelProvider } from "@/providers/WhitelabelProvider"

interface SubscribePageClientProps {
  whitelabel: WhitelabelType
  product: number | "free" | "freeinvestor"
}

export default function SubscribePageClient({ whitelabel, product }: SubscribePageClientProps) {
  const searchParams = useSearchParams()
  const coupon = searchParams.get("coupon")
  const mockPurchase = searchParams.get("mock_purchase") === "true"

  return (
    <WhitelabelProvider initialWhitelabel={whitelabel}>
      <SubscribeFlow initialProduct={product} whitelabel={whitelabel} coupon={coupon} mockPurchase={mockPurchase} />
    </WhitelabelProvider>
  )
}
