"use client"

import { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"

interface WelcomeStepProps {
  form: UseFormReturn<SubscribeFormData>
}

export default function WelcomeStep({ form }: WelcomeStepProps) {
  useEffect(() => {
    // Show welcome message for a moment before redirect
    const timer = setTimeout(() => {
      window.location.href = process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login"
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="w-full text-center">
      <p className="text-default-700 text-lg">
        Welcome to CashOffers.PRO! Redirecting you to set up your password...
      </p>
    </div>
  )
}
