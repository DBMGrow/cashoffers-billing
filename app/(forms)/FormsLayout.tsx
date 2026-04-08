import { Card, CardBody } from "@/components/Theme/Card"
import DefaultLogo from "@/components/Theme/Logo"
import Image from "next/image"

export interface WhitelabelBranding {
  primary_color?: string
  secondary_color?: string
  logo_url?: string
  marketing_website?: string
}

export default function FormsLayout({
  children,
  branding,
}: {
  children: React.ReactNode
  branding?: WhitelabelBranding | null
}) {
  const colorStyle = {
    ...(branding?.primary_color && { "--color-primary": branding.primary_color }),
    ...(branding?.secondary_color && { "--color-secondary": branding.secondary_color }),
  } as React.CSSProperties

  return (
    <div className="theme-default" style={colorStyle}>
      <div className="w-screen h-screen bg-secondary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10"></div>
      <Card className="min-w-[55vw] bg-white max-w-175 md:mr-75 rounded-l-none h-screen overflow-hidden">
        <CardBody className="h-full flex flex-col justify-between sm:p-8 bg-[url('/images/card-bg.jpg')] bg-no-repeat bg-bottom">
          <a href={branding?.marketing_website || "/"} target="_blank" rel="noopener noreferrer">
            {branding?.logo_url ? (
              <Image src={branding.logo_url} alt="Logo" height={48} width={200} className="object-contain" />
            ) : (
              <DefaultLogo isLight={false} />
            )}
          </a>
          {children}
        </CardBody>
      </Card>
    </div>
  )
}
