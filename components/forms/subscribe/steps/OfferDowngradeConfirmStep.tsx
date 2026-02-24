"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"

interface OfferDowngradeConfirmStepProps {
  form: UseFormReturn<SubscribeFormData>
}

export default function OfferDowngradeConfirmStep({ form }: OfferDowngradeConfirmStepProps) {
  const email = form.watch("email")

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="text-4xl mb-2">✅</div>
        <h3 className="text-lg font-semibold">Check Your Email</h3>
        <p className="text-gray-600">
          We've sent a reactivation link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Click the link in the email to reactivate your account. The link will expire in 24 hours.
        </p>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> If you don't see the email in a few minutes, check your spam folder.
        </p>
      </div>
    </div>
  )
}
