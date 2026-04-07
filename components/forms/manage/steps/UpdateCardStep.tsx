"use client"

import { useState } from "react"
import axios from "axios"
import type { User } from "@/types/api"
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import P from "@/components/Theme/P"

interface UpdateCardStepProps {
  user: User
  onBack: () => void
  onError: (message: string, title?: string, description?: string) => void
}

export default function UpdateCardStep({ user, onBack, onError }: UpdateCardStepProps) {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const paymentFormProps = {
    applicationId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
    locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
    cardTokenizeResponseReceived: async (token: any) => {
      setIsLoading(true)
      try {
        const { data: result } = await axios.post("/api/card", {
          user_id: user.user_id,
          card_token: token.token,
          exp_month: token.details.card.expMonth,
          exp_year: token.details.card.expYear,
          cardholder_name: user.name || "Cardholder",
        })

        if (result.success === "success") {
          setIsSuccess(true)
        } else {
          onError("Failed to update card. Please try again.")
        }
      } catch (error) {
        onError("Failed to update card. Please try again.")
      } finally {
        setIsLoading(false)
      }
    },
  }

  const buttonProps = {
    style: {
      backgroundColor: "var(--color-primary)",
      borderRadius: "0.5rem",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    },
  }

  const creditCardProps = {
    render: (Button: any) => {
      return <Button {...buttonProps}>Update Card</Button>
    },
  }

  if (isSuccess) {
    return (
      <div className="w-full flex flex-col gap-4">
        <P>Your card has been updated successfully!</P>
        <div className="w-[200px]">
          <ThemeButton color="primary" onPress={onBack}>
            Back to Dashboard
          </ThemeButton>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <PaymentForm {...paymentFormProps}>
        <CreditCard {...creditCardProps} />
      </PaymentForm>
      <div className="w-[200px]">
        <ThemeButton color="primary" onPress={onBack} isDisabled={isLoading}>
          Cancel
        </ThemeButton>
      </div>
    </div>
  )
}
