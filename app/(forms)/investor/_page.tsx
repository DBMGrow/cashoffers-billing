import { Suspense } from "react"
import InvestorPageClient from "./InvestorPageClient"
import { Spinner } from "@/components/Theme/Spinner"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export const metadata = {
  title: "Investor Sign Up | CashOffers.PRO",
  description: "Sign up as an investor for CashOffers.PRO",
}

export default function InvestorPage() {
  return (
    <ErrorBoundary>
      <Suspense>
        <InvestorPageClient />
      </Suspense>
    </ErrorBoundary>
  )
}
