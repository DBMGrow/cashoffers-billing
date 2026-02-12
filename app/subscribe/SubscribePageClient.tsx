"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardBody } from "@nextui-org/react"
import SubscribeFlow from "@/components/forms/subscribe/SubscribeFlow"
import DefaultLogo from "@/components/Theme/Logo"
import KWLogo from "@/components/Theme/KWLogo"
import YHSLogo from "@/components/Theme/YHSLogo"
import UCOLogo from "@/components/Theme/UCOLogo"
import MOPLogo from "@/components/Theme/MOPLogo"
import ECOLogo from "@/components/Theme/ECOLogo"
import PlatinumLogo from "@/components/Theme/PlatinumLogo"
import InvestorLogo from "@/components/Theme/InvestorLogo"
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

export default function SubscribePageClient() {
  const searchParams = useSearchParams()
  const whitelabel = (searchParams.get("w") || "default") as WhitelabelType
  const product = searchParams.get("product")
  const coupon = searchParams.get("coupon")

  // Check if investor product
  const isInvestor = product === "11"
  const LogoComponent = isInvestor ? InvestorLogo : logoComponents[whitelabel]
  const theme = themeClasses[whitelabel]

  const productNumber = product === "free" ? "free" : product === "freeinvestor" ? "freeinvestor" : Number(product) || 0

  return (
    <>
      <div
        className={`${theme} w-screen h-screen bg-primary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10`}
      ></div>
      <Card className={`min-w-[55vw] max-w-[700px] sm:mr-[300px] rounded-l-none h-screen ${theme}`}>
        <CardBody className="flex flex-col justify-between sm:p-8 bg-[url('/images/bg-element-8.svg')] bg-no-repeat bg-bottom">
          <LogoComponent isLight={false} />
          <SubscribeFlow initialProduct={productNumber} whitelabel={whitelabel} coupon={coupon} />
        </CardBody>
      </Card>
    </>
  )
}
