"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import type { ManageFormData } from "@/types/forms"
import type { User } from "@/types/api"
import Input from "@/components/UI/SignupForm/Input"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import Link from "next/link"
import { useLogin } from "@/hooks/api/useLogin"

interface LoginPasswordStepProps {
  form: UseFormReturn<ManageFormData>
  onSuccess: (user: User) => void
  onBack: () => void
  onError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function LoginPasswordStep({ form, onSuccess, onBack, onError, setAllowReset }: LoginPasswordStepProps) {
  const loginMutation = useLogin()
  const password = form.watch("password")
  const email = form.watch("email")
  const isDisabled = !password || password.length < 4

  const handleSubmit = async () => {
    if (isDisabled) return

    setAllowReset(false)

    try {
      const result = await loginMutation.mutateAsync({ email, password })

      if (result.success !== "success") {
        if (result.error === "PWINVALID") {
          onError("Invalid password. Please try again.")
        } else {
          onError("Error logging in. Please try again.")
        }
        setAllowReset(true)
        return
      }

      if (result.data) {
        onSuccess(result.data)
      }
    } catch (error) {
      onError("Error logging in. Please try again.")
      setAllowReset(true)
    }
  }

  return (
    <div className="w-full">
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("password", e.target.value)}
        isDisabled={isDisabled}
        isLoading={loginMutation.isPending}
        handleSubmit={handleSubmit}
      />
      <div className="pt-2">
        <Link href={process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login/forgot"} target="_blank">
          <ThemeButton color="primary">Reset Password</ThemeButton>
        </Link>
      </div>
    </div>
  )
}
