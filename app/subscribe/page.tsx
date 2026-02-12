import { Suspense } from "react"
import SubscribePageClient from "./SubscribePageClient"
import { Spinner } from "@nextui-org/react"

export const metadata = {
  title: "Sign Up | CashOffers.PRO",
  description: "Sign up for CashOffers.PRO",
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center"><Spinner /></div>}>
      <SubscribePageClient />
    </Suspense>
  )
}
