import FormsLayout from "@/app/(forms)/FormsLayout"
import { WhitelabelType } from "@/types/forms"

const validWhitelabelCodes: WhitelabelType[] = ["default", "kw", "yhs", "uco", "eco", "mop", "platinum"]

interface WhitelabelLayoutProps {
  children: React.ReactNode
  params: Promise<{ whitelabel_code: string }>
}

export default async function WhitelabelLayout({ children, params }: WhitelabelLayoutProps) {
  const { whitelabel_code } = await params
  const whitelabel = validWhitelabelCodes.includes(whitelabel_code as WhitelabelType)
    ? (whitelabel_code as WhitelabelType)
    : "default"

  return <FormsLayout whitelabel={whitelabel}>{children}</FormsLayout>
}
