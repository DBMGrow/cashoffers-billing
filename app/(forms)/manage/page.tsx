import { Suspense } from "react"
import ManagePageClient from "./ManagePageClient"
import { Spinner } from "@/components/Theme/Spinner"
import { ErrorBoundary } from "@/components/ErrorBoundary"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Manage Your Account | CashOffers.PRO",
  description: "Manage your CashOffers.PRO account",
}

export default function ManagePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="w-screen h-screen flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <ManagePageClient />
      </Suspense>
    </ErrorBoundary>
  )
}
