"use client"

import DefaultLogo from "@/components/Theme/Logo"
import { Card, CardBody } from "@/components/Theme/Card"
import Link from "next/link"

export default function Home(_props: { whitelabel?: string }) {
  return (
    <div>
      <div className="fixed w-screen h-screen bg-default-100 -z-10"></div>
      <section className="min-h-screen bg-[#112f45] bg-[url('/images/bg-5.jpg')] bg-cover bg-blend-multiply p-2 sm:p-8 flex flex-col">
        <div className="w-full flex justify-between items-start">
          <DefaultLogo isLight={true} />
          <Link className="text-white" href="/manage">
            Sign In
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl">
            <CardBody className="sm:p-10 text-center">
              <h1 className="text-2xl sm:text-3xl font-semibold mb-3">Account Management</h1>
              <p className="text-base text-default-600 mb-8">
                Sign in to review your subscription, update billing details, or make changes to your account.
              </p>
              <Link
                href="/manage"
                className="inline-block bg-primary text-white font-medium rounded-md px-6 py-3 shadow transition-all duration-200 hover:brightness-110 active:scale-95"
              >
                Continue to Sign In
              </Link>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  )
}
