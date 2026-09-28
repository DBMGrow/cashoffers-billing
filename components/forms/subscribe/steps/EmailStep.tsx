"use client"

import { useEffect, useState } from "react"
import { UseFormReturn } from "react-hook-form"
import axios from "axios"
import { useCheckUserExistsValidation } from "@/hooks/api/useCheckUserExistsValidation"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import validateEmail from "@/components/utils/validateEmail"

interface EmailStepProps {
  form: UseFormReturn<SubscribeFormData>
  /** The plan this signup was opened on. A number only for a real product, never "free"/"freeinvestor". */
  productId: number | null
  onNext: () => void
  onOfferDowngrade: () => void
  onUpgradeLinkSent: () => void
  onError: (message: string, title?: string, description?: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function EmailStep({
  form,
  productId,
  onNext,
  onOfferDowngrade,
  onUpgradeLinkSent,
  onError,
  setAllowReset,
}: EmailStepProps) {
  const email = form.watch("email")
  const isValid = validateEmail(email)
  const checkUser = useCheckUserExistsValidation()
  const [sendingUpgradeLink, setSendingUpgradeLink] = useState(false)

  // Automatically sync loading state with setAllowReset
  useEffect(() => {
    setAllowReset(!checkUser.isPending && !sendingUpgradeLink)
  }, [checkUser.isPending, sendingUpgradeLink, setAllowReset])

  const emailInUse = () =>
    onError(
      "",
      "Email Already In Use",
      "The email you entered is already associated with an account. Please use a different email or contact support if you need help."
    )

  /**
   * An existing account whose upgrade is this plan (an Express Offers Guest on the Pro link) is
   * upgraded in place, never duplicated: the main API emails it the sign-in-and-upgrade link. Any
   * other existing account, or any failure asking, keeps today's "Email Already In Use".
   */
  const tryUpgradeLink = async () => {
    if (productId == null) return emailInUse()

    setSendingUpgradeLink(true)
    try {
      const { data } = await axios.post("/api/signup/sendupgradelink", { email, product_id: productId })
      if (data?.sent) return onUpgradeLinkSent()
      emailInUse()
    } catch {
      emailInUse()
    } finally {
      setSendingUpgradeLink(false)
    }
  }

  const handleSubmit = () => {
    if (!isValid) return

    checkUser.mutate(email, {
      onSuccess: (data) => {
        if (data?.offerDowngrade) {
          onOfferDowngrade()
        } else if (data?.userExists) {
          tryUpgradeLink()
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
      name="email"
      value={email}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("email", e.target.value)}
      isDisabled={!isValid}
      isLoading={checkUser.isPending || sendingUpgradeLink}
      handleSubmit={handleSubmit}
    />
  )
}
