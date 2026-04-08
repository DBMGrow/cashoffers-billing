"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"

interface TeamStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
}

export default function TeamStep({ form, onNext, onBack }: TeamStepProps) {
  const nameTeam = form.watch("name_team") || ""

  return (
    <Input
      placeholder="My Team"
      name="name_team"
      value={nameTeam}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("name_team", e.target.value)}
      isDisabled={false}
      isLoading={false}
      handleSubmit={onNext}
    />
  )
}
