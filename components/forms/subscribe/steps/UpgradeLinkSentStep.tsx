"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"

interface UpgradeLinkSentStepProps {
  form: UseFormReturn<SubscribeFormData>
}

/**
 * Shown when the email entered already has an account whose upgrade is this plan (an Express
 * Offers Guest on the Pro link). The main API has emailed that account its sign-in-and-upgrade
 * link, so the upgrade happens on the existing account instead of a second one.
 */
export default function UpgradeLinkSentStep({ form }: UpgradeLinkSentStepProps) {
  const email = form.watch("email")

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">We Found Your Account</h3>
        <p className="text-gray-600">
          <strong>{email}</strong>&nbsp;already has an account, so there is no need to create a new one. We&apos;ve
          emailed you a link to upgrade it.
        </p>
        <p className="text-sm text-gray-500">
          The link signs you in and takes you straight to checkout. It expires in 7 days and can be used once.
        </p>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong>&nbsp;If you don&apos;t see the email in a few minutes, check your spam folder.
        </p>
      </div>
    </div>
  )
}
