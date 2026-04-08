import Home from "@/app/page"
import { Suspense } from "react"

export default async function WhitelabelHome({ params }: { params: Promise<{ whitelabel_code: string }> }) {
  const { whitelabel_code } = await params
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Home whitelabel={whitelabel_code} />
    </Suspense>
  )
}
