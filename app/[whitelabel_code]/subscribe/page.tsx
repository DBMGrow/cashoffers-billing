import { redirect } from "next/navigation"
import { WhitelabelType } from "@/types/forms"

interface SubscribeNoProductPageProps {
  params: Promise<{ whitelabel_code: string }>
}

export default async function SubscribeNoProductPage({ params }: SubscribeNoProductPageProps) {
  const { whitelabel_code } = await params
  const whitelabel = whitelabel_code as WhitelabelType

  const redirectUrl =
    whitelabel === "yhs" ? "https://www.instantofferspro.com/yhs" : "https://www.instantofferspro.com/agents"

  redirect(redirectUrl)
}
