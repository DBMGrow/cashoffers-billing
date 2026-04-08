"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import formatPhone from "@/components/utils/formatPhone"

interface PhoneStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
}

export default function PhoneStep({ form, onNext, onBack }: PhoneStepProps) {
  const phone = form.watch("phone") || ""
  const isDisabled = !phone || phone.length < 14 // 14 is the min length of a formatted phone number

  return (
    <Input
      type="tel"
      placeholder="(123) 456-7890"
      name="phone"
      value={phone}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("phone", formatPhone(e.target.value))}
      isDisabled={isDisabled}
      isLoading={false}
      handleSubmit={onNext}
    />
  )
}
