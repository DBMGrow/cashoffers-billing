"use client"

import { useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { useCheckSlugExistsValidation } from "@/hooks/api/useCheckSlugExistsValidation"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import { ThemeButton } from "@/components/Theme/ThemeButton"

interface SlugStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
  onError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function SlugStep({ form, onNext, onBack, onError, setAllowReset }: SlugStepProps) {
  const slug = form.watch("slug") || ""
  const isDisabled = !slug
  const checkSlug = useCheckSlugExistsValidation()

  // Automatically sync loading state with setAllowReset
  useEffect(() => {
    setAllowReset(!checkSlug.isPending)
  }, [checkSlug.isPending, setAllowReset])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length > 30) return
    if (value.length > 0) {
      form.setValue("slug", value.replace(/[^a-zA-Z0-9-]/g, ""))
    } else {
      form.setValue("slug", "")
    }
  }

  const handleSubmit = () => {
    if (isDisabled) return

    checkSlug.mutate(slug, {
      onSuccess: (data) => {
        if (data?.userExists) {
          onError("This domain prefix is already in use. Please try a different one.")
        } else {
          onNext()
        }
      },
      onError: () => {
        onError("Error checking domain prefix. Please try again.")
      },
    })
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
          name="slug"
          value={slug}
          onChange={onChange}
          isDisabled={isDisabled}
          isLoading={checkSlug.isPending}
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
