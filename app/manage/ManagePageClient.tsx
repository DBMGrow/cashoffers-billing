"use client"

import { Card, CardBody } from "@nextui-org/react"
import ManageFlow from "@/components/forms/manage/ManageFlow"
import DefaultLogo from "@/components/Theme/Logo"

export default function ManagePageClient() {
  return (
    <>
      <div className="w-screen h-screen bg-primary bg-[url('/images/bg-3.jpg')] bg-cover bg-blend-multiply fixed -z-10"></div>
      <Card className="min-w-[55vw] max-w-[700px] sm:mr-[300px] rounded-l-none h-screen">
        <CardBody className="flex flex-col justify-between sm:p-8 bg-[url('/images/bg-element-8.svg')] bg-no-repeat bg-bottom">
          <DefaultLogo isLight={false} />
          <ManageFlow />
        </CardBody>
      </Card>
    </>
  )
}
