"use client"

import { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { useCheckUserExistsValidation } from "@/hooks/api/useCheckUserExistsValidation"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import validateEmail from "@/components/utils/validateEmail"

interface EmailStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onOfferDowngrade: () => void
  onError: (message: string, title?: string, description?: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function EmailStep({ form, onNext, onOfferDowngrade, onError, setAllowReset }: EmailStepProps) {
  const email = form.watch("email")
  const isValid = validateEmail(email)
  const checkUser = useCheckUserExistsValidation()

  // Automatically sync loading state with setAllowReset
  useEffect(() => {
    setAllowReset(!checkUser.isPending)
  }, [checkUser.isPending, setAllowReset])

  const handleSubmit = () => {
    if (!isValid) return

    checkUser.mutate(email, {
      onSuccess: (data) => {
        if (data?.offerDowngrade) {
          onOfferDowngrade()
        } else if (data?.userExists) {
          onError(
            "",
            "Email Already In Use",
            "The email you entered is already associated with an account. Please use a different email or contact support if you need help."
          )
        } else {
          onNext()
        }
      },
      onError: () => {
        onError("Error checking user. Please try again.")
      },
    })
  }

  return (
    <Input
      placeholder="john.doe@example.com"
      name="email"
      value={email}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("email", e.target.value)}
      isDisabled={!isValid}
      isLoading={checkUser.isPending}
      handleSubmit={handleSubmit}
    />
  )
}
