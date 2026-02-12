"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import { useCheckUserExists } from "@/hooks/api/useCheckUserExists"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import validateEmail from "@/components/utils/validateEmail"

interface EmailStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  setAllowReset: (allow: boolean) => void
}

export default function EmailStep({ form, onNext, setAllowReset }: EmailStepProps) {
  const [isLoading, setIsLoading] = useState(false)
  const email = form.watch("email")
  const isValid = validateEmail(email)

  const handleSubmit = async () => {
    if (!isValid) return

    setIsLoading(true)
    setAllowReset(false)

    try {
      const res = await fetch(`/api/checkuserexists/${encodeURIComponent(email)}`)
      const data = await res.json()

      if (data.success !== "success") {
        alert("Error checking user. Please try again.")
        return
      }

      if (data.userExists) {
        alert("This email is already in use. Please try a different email.")
        return
      }

      onNext()
    } catch (error) {
      alert("Error checking user. Please try again.")
    } finally {
      setIsLoading(false)
      setAllowReset(true)
    }
  }

  return (
    <Input
      placeholder="john.doe@example.com"
      value={email}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("email", e.target.value)}
      isDisabled={!isValid}
      isLoading={isLoading}
      handleSubmit={handleSubmit}
    />
  )
}
