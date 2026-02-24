"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import axios from "axios"
import type { SubscribeFormData } from "@/types/forms"

interface OfferDowngradeStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function OfferDowngradeStep({
  form,
  onNext,
  onError,
  setAllowReset,
}: OfferDowngradeStepProps) {
  const [loading, setLoading] = useState(false)
  const email = form.watch("email")

  const handleReactivate = async () => {
    setLoading(true)
    setAllowReset(false)

    try {
      const response = await axios.post("/api/signup/sendreactivation", { email })

      if (response.data.success === "success") {
        onNext()
      } else {
        onError(response.data.error || "Failed to send reactivation email")
      }
    } catch (error: any) {
      onError(error.response?.data?.error || "Failed to send reactivation email. Please try again.")
    } finally {
      setLoading(false)
      setAllowReset(true)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Reactivate Your Account</h3>
        <p className="text-gray-600">
          Your account is currently inactive. Would you like to reactivate it as a freemium user?
        </p>
        <p className="text-sm text-gray-500">
          We'll send you an email with a link to reactivate your account.
        </p>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleReactivate}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Yes, Reactivate My Account"}
        </button>
      </div>
    </div>
  )
}
