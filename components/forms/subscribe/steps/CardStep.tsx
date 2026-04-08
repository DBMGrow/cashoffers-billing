"use client"

import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk"
import { useWhitelabel } from "@/providers/WhitelabelProvider"

interface CardStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
}

export default function CardStep({ form, onNext, onBack }: CardStepProps) {
  const { currentWhitelabel } = useWhitelabel()

  const primaryColor = currentWhitelabel?.primary_color || "#4d9cb9"

  const paymentFormProps = {
    applicationId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
    locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
    cardTokenizeResponseReceived: async (token: any) => {
      form.setValue("cardData", token)
      onNext()
    },
  }

  const buttonProps = {
    style: {
      backgroundColor: primaryColor,
      borderRadius: "0.5rem",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    },
  }

  const creditCardProps = {
    render: (Button: any) => {
      return <Button {...buttonProps}>Add Card</Button>
    },
  }

  return (
    <div className="w-full">
      <PaymentForm {...paymentFormProps}>
        <CreditCard {...creditCardProps} />
      </PaymentForm>
    </div>
  )
}
