import { Suspense } from "react"
import { redirect } from "next/navigation"
import SubscribePageClient from "./SubscribePageClient"
import { Spinner } from "@/components/Theme/Spinner"

export const metadata = {
  title: "Sign Up | CashOffers.PRO",
  description: "Sign up for CashOffers.PRO",
}

interface SubscribePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams
  const whitelabel = (params.w as string) || "default"
  const product = params.product as string

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
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <SubscribePageClient />
    </Suspense>
  )
}
