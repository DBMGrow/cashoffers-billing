import { Suspense } from "react"
import ManagePageClient from "./ManagePageClient"
import { Spinner } from "@/components/Theme/Spinner"

export const metadata = {
  title: "Manage Your Account | CashOffers.PRO",
  description: "Manage your CashOffers.PRO account",
}

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ManagePageClient />
    </Suspense>
  )
}
