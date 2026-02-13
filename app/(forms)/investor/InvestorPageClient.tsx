"use client"

import InvestorFlow from "@/components/forms/investor/InvestorFlow"
import InvestorLogo from "@/components/Theme/InvestorLogo"

export default function InvestorPageClient() {
  return (
    <>
      <InvestorLogo isLight={false} />
      <InvestorFlow />
    </>
  )
}
