"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"

interface BrokerStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
}

export default function BrokerStep({ form, onNext, onBack }: BrokerStepProps) {
  const nameBroker = form.watch("name_broker") || ""
  const isDisabled = !nameBroker

  return (
    <Input
      placeholder="e.g. Keller Williams, RE/MAX"
      name="name_broker"
      value={nameBroker}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("name_broker", e.target.value)}
      isDisabled={isDisabled}
      isLoading={false}
      handleSubmit={onNext}
    />
  )
}
