"use client"

import DefaultLogo from "@/components/Theme/Logo"
import { Card, CardBody } from "@nextui-org/react"
import Pricing from "@/components/UI/LandingPage/Pricing"
import Link from "next/link"
import YoutubeVideo from "@/components/UI/LandingPage/YoutubeVideo"

export default function Home() {
  return (
    <div>
      <div className="fixed w-screen h-screen bg-default-100 -z-10"></div>
      <section className="min-h-[800px] bg-[#112f45] bg-[url('/images/bg-5.jpg')] bg-cover bg-blend-multiply p-2 sm:p-8 flex flex-col justify-between">
        <div className="w-full flex justify-between items-start">
          <DefaultLogo isLight={true} />
          <Link className="text-white font-medium" href={process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login"}>
            Log In
          </Link>
        </div>
        <div className="w-full flex justify-around items-center flex-col xl:flex-row gap-10">
          <div className="w-full flex justify-center items-center">
            <h1 className="w-full text-center xl:text-left sm:w-[90%] text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white font-bold leading-1">
              All The Offers On
              <br /> Your Client&apos;s Homes.
              <br /> <span className="text-primary">All In One Place</span>
              <span className="text-secondary">.</span>
            </h1>
          </div>
        </div>
        <div className="mb-[100px]"></div>
      </section>
      <section className="min-h-[650px] w-screen flex items-stretch justify-center -mt-[100px]">
        <Card className="rounded-b-none w-full md:min-w-[800px] md:w-2/3">
          <CardBody className="flex flex-col gap-8 sm:p-8 bg-[url('/images/bg-element-8.svg')] bg-no-repeat bg-right-bottom bg-[length:100%]">
            <div className="pt-10 w-full text-center text-default-700">
              <h2 className="text-3xl font-bold">Pricing</h2>
            </div>
            <Pricing whitelabel="default" />
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
