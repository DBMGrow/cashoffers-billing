import { Suspense } from "react"
import InvestorPageClient from "./InvestorPageClient"
import { Spinner } from "@nextui-org/react"

export const metadata = {
  title: "Investor Sign Up | CashOffers.PRO",
  description: "Sign up as an investor for CashOffers.PRO",
}

export default function InvestorPage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center"><Spinner /></div>}>
      <InvestorPageClient />
    </Suspense>
  )
}
