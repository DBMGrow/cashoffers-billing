"use client"

import DefaultLogo from "@/components/Theme/Logo"
import { Card, CardBody } from "@/components/Theme/Card"
import Pricing from "@/components/UI/LandingPage/Pricing"
import Link from "next/link"

export default function Home() {
  return (
    <div>
      <div className="fixed w-screen h-screen bg-default-100 -z-10"></div>
      <section className="min-h-200 bg-[#112f45] bg-[url('/images/bg-5.jpg')] bg-cover bg-blend-multiply p-2 sm:p-8 flex flex-col justify-between">
        <div className="w-full flex justify-between items-start">
          <DefaultLogo isLight={true} />
          <Link className="text-white" href={process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login"}>
            Log In
          </Link>
        </div>
        <div className="w-full flex justify-around items-center flex-col xl:flex-row gap-10">
          <div className="w-full flex justify-center items-center"></div>
        </div>
        <div className="mb-25"></div>
      </section>
      <section className="min-h-162.5 w-screen flex items-stretch justify-center -mt-25">
        <Card className="rounded-b-none w-full md:min-w-200 md:w-2/3 overflow-hidden">
          <CardBody className="flex flex-col gap-8 sm:p-8 bg-[url('/images/card-bg.jpg')]  bg-no-repeat bg-bottom-right bg-size-[100%]">
            <div className="pt-10 w-full text-center">
              <h2>Pricing</h2>
            </div>
            <Pricing whitelabel="default" />
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
