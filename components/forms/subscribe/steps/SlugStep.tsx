"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import { ThemeButton } from "@/components/Theme/ThemeButton"

interface SlugStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
  setAllowReset: (allow: boolean) => void
}

export default function SlugStep({ form, onNext, onBack, setAllowReset }: SlugStepProps) {
  const [isLoading, setIsLoading] = useState(false)
  const slug = form.watch("slug") || ""
  const isDisabled = !slug

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length > 30) return
    if (value.length > 0) {
      form.setValue("slug", value.replace(/[^a-zA-Z0-9-]/g, ""))
    } else {
      form.setValue("slug", "")
    }
  }

  const handleSubmit = async () => {
    if (isDisabled) return

    setIsLoading(true)
    setAllowReset(false)

    try {
      const res = await fetch(`/api/checkslugexists/${encodeURIComponent(slug)}`)
      const data = await res.json()

      if (data.success !== "success") {
        alert("Error checking domain prefix. Please try again.")
        return
      }

      if (data.userExists) {
        alert("This domain prefix is already in use. Please try a different one.")
        return
      }

      onNext()
    } catch (error) {
      alert("Error checking domain prefix. Please try again.")
    } finally {
      setIsLoading(false)
      setAllowReset(true)
    }
  }

  const handleSkip = () => {
    form.setValue("slug", null)
    onNext()
  }

  return (
    <div className="w-full">
      <div className="flex gap-2 items-end">
        <Input
          placeholder="johndoe"
          value={slug}
          onChange={onChange}
          isDisabled={isDisabled}
          isLoading={isLoading}
          handleSubmit={handleSubmit}
        />
        <ThemeButton onClick={handleSkip} color="secondary">
          Skip
        </ThemeButton>
      </div>
      <p className="text-sm">{slug || "johndoe"}.highestprice.com</p>
    </div>
  )
}
