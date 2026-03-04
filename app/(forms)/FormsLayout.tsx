import { Card, CardBody } from "@/components/Theme/Card"
import DefaultLogo from "@/components/Theme/Logo"
import KWLogo from "@/components/Theme/KWLogo"
import YHSLogo from "@/components/Theme/YHSLogo"
import UCOLogo from "@/components/Theme/UCOLogo"
import MOPLogo from "@/components/Theme/MOPLogo"
import ECOLogo from "@/components/Theme/ECOLogo"
import PlatinumLogo from "@/components/Theme/PlatinumLogo"
import { WhitelabelType } from "@/types/forms"
import Image from "next/image"

export interface WhitelabelBranding {
  primary_color?: string
  secondary_color?: string
  logo_url?: string
}

const logoComponents: Partial<Record<string, React.ComponentType<{ isLight: boolean }>>> = {
  default: DefaultLogo,
  kw: KWLogo,
  yhs: YHSLogo,
  uco: UCOLogo,
  mop: MOPLogo,
  eco: ECOLogo,
  platinum: PlatinumLogo,
}

const themeClasses: Partial<Record<string, string>> = {
  default: "theme-default",
  kw: "theme-kw",
  yhs: "theme-yhs",
  uco: "theme-uco",
  mop: "theme-default",
  eco: "theme-default",
  platinum: "theme-default",
}

export default function FormsLayout({
  children,
  whitelabel,
  branding,
}: {
  children: React.ReactNode
  whitelabel: WhitelabelType
  branding?: WhitelabelBranding | null
}) {
  const LogoComponent = logoComponents[whitelabel]
  const theme = themeClasses[whitelabel] ?? "theme-default"

  const colorStyle = {
    ...(branding?.primary_color && { "--color-primary": branding.primary_color }),
    ...(branding?.secondary_color && { "--color-secondary": branding.secondary_color }),
  } as React.CSSProperties

  return (
    <div className={theme} style={colorStyle}>
      <div className="w-screen h-screen bg-secondary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10"></div>
      <Card className="min-w-[55vw] bg-white max-w-175 md:mr-75 rounded-l-none h-screen overflow-hidden">
        <CardBody className="h-full flex flex-col justify-between sm:p-8 bg-[url('/images/card-bg.jpg')] bg-no-repeat bg-bottom">
          {LogoComponent ? (
            <LogoComponent isLight={false} />
          ) : branding?.logo_url ? (
            <Image src={branding.logo_url} alt="Logo" height={48} width={200} className="object-contain" />
          ) : (
            <DefaultLogo isLight={false} />
          )}
          {children}
        </CardBody>
      </Card>
    </div>
  )
}
