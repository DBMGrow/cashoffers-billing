"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"

/**
 * Brokerage pre-filled on the product-link signup, keyed by the white label code the page resolved
 * from `Whitelabels.code`. It is the form's default value (not a placeholder), so it submits unless
 * the agent changes it. ExpressOffers is sold to eXp Realty agents only. `kw` is kept as it was.
 */
const DEFAULT_BROKER_BY_WHITELABEL: Record<string, string> = {
  kw: "Keller Williams",
  EXP: "eXp Realty",
}

export function defaultBrokerFor(whitelabel: string | null | undefined): string | null {
  return (whitelabel && DEFAULT_BROKER_BY_WHITELABEL[whitelabel]) || null
}

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
