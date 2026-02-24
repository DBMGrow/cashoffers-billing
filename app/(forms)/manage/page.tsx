import { Suspense } from "react"
import ManagePageClient from "./ManagePageClient"
import { Spinner } from "@/components/Theme/Spinner"
import { ProductProvider } from "@/providers/ProductProvider"
import { WhitelabelProvider } from "@/providers/WhitelabelProvider"

export const metadata = {
  title: "Manage Your Account | CashOffers.PRO",
  description: "Manage your CashOffers.PRO account",
}

export default function ManagePage() {
  return (
    <WhitelabelProvider initialWhitelabel="default">
      <ProductProvider mode="manage">
        <Suspense
          fallback={
            <div className="w-screen h-screen flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <ManagePageClient />
        </Suspense>
      </ProductProvider>
    </WhitelabelProvider>
  )
}
