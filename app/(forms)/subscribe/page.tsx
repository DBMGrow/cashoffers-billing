import { Suspense } from "react"
import { redirect } from "next/navigation"
import SubscribePageClient from "./SubscribePageClient"
import { Spinner } from "@/components/Theme/Spinner"
import { ProductProvider } from "@/providers/ProductProvider"
import { WhitelabelProvider } from "@/providers/WhitelabelProvider"

export const metadata = {
  title: "Sign Up | CashOffers.PRO",
  description: "Sign up for CashOffers.PRO",
}

interface SubscribePageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function SubscribePage({ searchParams }: SubscribePageProps) {
  const whitelabel = (searchParams.w as string) || "default"
  const product = searchParams.product as string

  // Flow 6: Handle product=0 (deprecated product ID)
  if (product === "0") {
    const redirectUrl =
      whitelabel === "yhs"
        ? "https://www.instantofferspro.com/yhs"
        : "https://www.instantofferspro.com/agents"
    redirect(redirectUrl)
  }

  // Flows 35, 38-39: Handle missing product parameter
  if (!product) {
    const redirectUrl =
      whitelabel === "yhs"
        ? "https://www.instantofferspro.com/yhs"
        : "https://www.instantofferspro.com/agents"
    redirect(redirectUrl)
  }

  return (
    <WhitelabelProvider initialWhitelabel={whitelabel}>
      <ProductProvider whitelabel={whitelabel} mode="signup">
        <Suspense
          fallback={
            <div className="w-screen h-screen flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <SubscribePageClient />
        </Suspense>
      </ProductProvider>
    </WhitelabelProvider>
  )
}
