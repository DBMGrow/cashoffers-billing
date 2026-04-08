import { redirect } from "next/navigation"
import { Suspense } from "react"
import SubscribePageClient from "./SubscribePageClient"
import { Spinner } from "@/components/Theme/Spinner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { WhitelabelType } from "@/types/forms"
import { db } from "@api/lib/database"

export const metadata = {
  title: "Sign Up | CashOffers.PRO",
  description: "Sign up for CashOffers.PRO",
}

interface SubscribePageProps {
  params: Promise<{ whitelabel_code: string; product: string }>
}

export default async function SubscribePage({ params }: SubscribePageProps) {
  const { whitelabel_code, product } = await params

  const row = await db
    .selectFrom("Whitelabels")
    .select("code")
    .where("code", "=", whitelabel_code)
    .executeTakeFirst()

  const whitelabel = (row?.code ?? "default") as WhitelabelType

  // Flow 6: Handle product=0 (deprecated product ID)
  if (product === "0") {
    const redirectUrl =
      whitelabel === "yhs" ? "https://www.instantofferspro.com/yhs" : "https://www.instantofferspro.com/agents"
    redirect(redirectUrl)
  }

  const productValue = Number(product) || 0

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="w-screen h-screen flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <SubscribePageClient whitelabel={whitelabel} product={productValue} />
      </Suspense>
    </ErrorBoundary>
  )
}
