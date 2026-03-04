import FormsLayout from "@/app/(forms)/FormsLayout"
import { WhitelabelType } from "@/types/forms"
import { db } from "@api/lib/database"

interface WhitelabelLayoutProps {
  children: React.ReactNode
  params: Promise<{ whitelabel_code: string }>
}

export default async function WhitelabelLayout({ children, params }: WhitelabelLayoutProps) {
  const { whitelabel_code } = await params

  const row = await db
    .selectFrom("Whitelabels")
    .select(["code", "data"])
    .where("code", "=", whitelabel_code)
    .executeTakeFirst()

  const whitelabel = (row?.code ?? "default") as WhitelabelType
  const branding = row?.data as { primary_color?: string; secondary_color?: string; logo_url?: string } | null

  return (
    <FormsLayout whitelabel={whitelabel} branding={branding}>
      {children}
    </FormsLayout>
  )
}
