"use client"

import { Card, CardBody } from "@nextui-org/react"
import InvestorFlow from "@/components/forms/investor/InvestorFlow"
import InvestorLogo from "@/components/Theme/InvestorLogo"

export default function InvestorPageClient() {
  return (
    <>
      <div className="w-screen h-screen bg-primary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10"></div>
      <Card className="min-w-[55vw] max-w-[700px] sm:mr-[300px] rounded-l-none h-screen">
        <CardBody className="flex flex-col justify-between sm:p-8 bg-[url('/images/bg-element-8.svg')] bg-no-repeat bg-bottom">
          <InvestorLogo isLight={false} />
          <InvestorFlow />
        </CardBody>
      </Card>
    </>
  )
}
