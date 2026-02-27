import { Card, CardBody } from "@/components/Theme/Card"
import DefaultLogo from "@/components/Theme/Logo"
import KWLogo from "@/components/Theme/KWLogo"
import YHSLogo from "@/components/Theme/YHSLogo"
import UCOLogo from "@/components/Theme/UCOLogo"
import MOPLogo from "@/components/Theme/MOPLogo"
import ECOLogo from "@/components/Theme/ECOLogo"
import PlatinumLogo from "@/components/Theme/PlatinumLogo"
import { WhitelabelType } from "@/types/forms"

const logoComponents: Record<WhitelabelType, React.ComponentType<{ isLight: boolean }>> = {
  default: DefaultLogo,
  kw: KWLogo,
  yhs: YHSLogo,
  uco: UCOLogo,
  mop: MOPLogo,
  eco: ECOLogo,
  platinum: PlatinumLogo,
}

const themeClasses: Record<WhitelabelType, string> = {
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
}: {
  children: React.ReactNode
  whitelabel: WhitelabelType
}) {
  const LogoComponent = logoComponents[whitelabel] ?? DefaultLogo
  const theme = themeClasses[whitelabel] ?? "theme-default"

  return (
    <>
      <div
        className={`${theme} w-screen h-screen bg-primary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10`}
      ></div>
      <Card className="min-w-[55vw] bg-white max-w-175 md:mr-75 rounded-l-none h-screen overflow-hidden">
        <CardBody className="h-full flex flex-col justify-between sm:p-8 bg-[url('/images/card-bg.jpg')] bg-no-repeat bg-bottom">
          <LogoComponent isLight={false} />
          {children}
        </CardBody>
      </Card>
    </>
  )
}
