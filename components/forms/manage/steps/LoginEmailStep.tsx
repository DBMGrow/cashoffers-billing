"use client"

import { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { useCheckUserExistsValidation } from "@/hooks/api/useCheckUserExistsValidation"
import type { ManageFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import validateEmail from "@/components/utils/validateEmail"

interface LoginEmailStepProps {
  form: UseFormReturn<ManageFormData>
  onNext: () => void
  onError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function LoginEmailStep({ form, onNext, onError, setAllowReset }: LoginEmailStepProps) {
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
        if (!data?.userExists) {
          onError("There's no account linked to this email. Please try a different email.")
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
      value={email}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("email", e.target.value)}
      isDisabled={!isValid}
      isLoading={checkUser.isPending}
      handleSubmit={handleSubmit}
    />
  )
}
