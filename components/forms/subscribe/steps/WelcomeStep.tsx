"use client"

import { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"

interface WelcomeStepProps {
  form: UseFormReturn<SubscribeFormData>
}

export default function WelcomeStep({ form }: WelcomeStepProps) {
  console.log("WelcomeStep form data:", form.getValues())

  useEffect(() => {
    // // Show welcome message for a moment before redirect
    // const timer = setTimeout(() => {
    //   window.location.href = process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login/welcome?token="
    // }, 2000)
    // return () => clearTimeout(timer)
  }, [])

  return <p>Welcome to CashOffers.PRO! Redirecting you to set up your password...</p>
}
