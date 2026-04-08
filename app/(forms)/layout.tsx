import FormsLayout from "./FormsLayout"
import { db } from "@api/lib/database"

export default async function Layout({ children }: { children: React.ReactNode }) {
  const row = await db
    .selectFrom("Whitelabels")
    .select(["code", "data"])
    .where("code", "=", "default")
    .executeTakeFirst()

  const branding = row?.data as {
    primary_color?: string
    secondary_color?: string
    logo_url?: string
    marketing_website?: string
  } | null

  return (
    <FormsLayout branding={branding}>
      {children}
    </FormsLayout>
  )
}
