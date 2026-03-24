"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import { usePurchase } from "@/hooks/api/usePurchase"
import { useProducts, isProductFree } from "@/providers/ProductProvider"
import Row from "@/components/Theme/Row"
import Table from "@/components/Theme/Table"
import InvestorConsent from "@/components/UI/SignupForm/InvestorConsent"
import GeneralConsent from "@/components/UI/SignupForm/GeneralConsent"
import CommunicationConsent from "@/components/UI/SignupForm/CommunicationConsent"
import { useRouter } from "next/navigation"

interface ReviewStepProps {
  form: UseFormReturn<SubscribeFormData>
  mockPurchase?: boolean
  whitelabel?: string
  onNext: () => void
  onBack: () => void
  onError: (message: string) => void
  onCardError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function ReviewStep({
  form,
  mockPurchase = false,
  whitelabel,
  onNext,
  onBack,
  onError,
  onCardError,
  setAllowReset,
}: ReviewStepProps) {
  const router = useRouter()
  const formData = form.watch()
  const product = formData.product

  // Fetch products using TanStack Query
  const { getProductById } = useProducts({
    mode: "signup",
    whitelabel,
  })
  const productData = getProductById(product)

  const isInvestorProduct = productData?.data?.user_config?.role === "INVESTOR"

  const [isChecked, setIsChecked] = useState(!isInvestorProduct)
  const [isGeneralChecked, setIsGeneralChecked] = useState(false)
  const [isCommunicationChecked, setIsCommunicationChecked] = useState(false)

  const purchaseMutation = usePurchase()
  const isFree = isProductFree(productData)

  const planName = productData?.product_name || "Unknown Plan"

  // Calculate prices from product data
  const monthlyPrice = (productData?.data?.renewal_cost || 0) / 100
  const signupFeeAmount = (productData?.data?.signup_fee || 0) / 100

  const productPrice = monthlyPrice
  const priceToday = productPrice + signupFeeAmount

  const CARD_ERROR_MESSAGES: Record<string, string> = {
    INSUFFICIENT_FUNDS:
      "Your card was declined due to insufficient funds. Please check your balance or try a different card.",
    CVV_FAILURE: "The security code (CVV) you entered doesn't match. Please double-check and try again.",
    ADDRESS_VERIFICATION_FAILURE:
      "The billing address doesn't match your card records. Please check your billing address and try again.",
    EXPIRED_CARD: "Your card has expired. Please use a different card.",
    INVALID_CARD: "Your card number is invalid. Please check your card details and try again.",
    INVALID_EXPIRATION: "The expiration date is invalid. Please check your card details and try again.",
    CARD_NOT_SUPPORTED: "This card type is not supported. Please try a Visa, Mastercard, or American Express.",
    CARD_DECLINED: "Your card was declined. Please try a different card or contact your bank.",
    GENERIC_DECLINE: "Your card was declined. Please try a different card or contact your bank.",
    PAN_FAILURE: "Your card number could not be verified. Please check your card details and try again.",
    CARDHOLDER_INSUFFICIENT_PERMISSIONS:
      "Your card issuer has blocked this transaction. Please contact your bank or use a different card.",
    INVALID_CARD_DATA: "Your card information is invalid. Please check your card details and try again.",
    CARD_CREATION_FAILED:
      "Your card information is invalid or could not be processed. Please check your card details and try again.",
    PUR08: "Your card was declined. Please try a different card or contact your bank.",
  }

  const isCardError = (code?: string): boolean => (code ? code in CARD_ERROR_MESSAGES : false)

  const getCardErrorMessage = (code?: string): string =>
    (code && CARD_ERROR_MESSAGES[code]) ||
    "We were unable to process your card. Please verify your card information and try again."

  const handleSubmit = async () => {
    // Use Square's sandbox test nonce in mock mode (card step is skipped)
    const effectiveCardData = mockPurchase
      ? { token: "cnon:card-nonce-ok", details: { card: { expMonth: 12, expYear: 2026 } } }
      : form.getValues("cardData")
    if (!effectiveCardData && !isFree) {
      onError("Please add a card.")
      return
    }

    setAllowReset(false)

    let url = ""
    try {
      url = window.location.href
    } catch (error) {}

    let result
    try {
      result = await purchaseMutation.mutateAsync({
        product_id: product,
        email: formData.email,
        phone: formData.phone,
        name: formData.name,
        card_token: effectiveCardData?.token,
        exp_month: effectiveCardData?.details.card.expMonth,
        exp_year: effectiveCardData?.details.card.expYear,
        cardholder_name: formData.name,
        name_broker: formData.name_broker,
        name_team: formData.name_team,
        slug: formData.slug,
        url,
        coupon: formData.coupon,
        mock_purchase: mockPurchase,
      })
    } catch (error) {
      // Network failure or unexpected error before any response
      onError("Something went wrong. Please try again. If the problem persists, please contact support.")
      return
    }

    console.log("Purchase result:", result)

    if (result.success !== "success") {
      // Card error - send user back to card form to re-enter payment info
      if (isCardError(result.code)) {
        onCardError(getCardErrorMessage(result.code))
        return
      }

      // System error - show error step
      onError("Something went wrong. Please try again. If the problem persists, please contact support.")
      return
    }

    // Check if user provisioning failed (payment succeeded but account creation failed)
    if (result.data?.userProvisioned === false) {
      onError(
        "Your payment was received, but we ran into an issue setting up your account. " +
          "Our team has been notified and will reach out to you within 24 hours. " +
          "Please check your email for more details."
      )
      setAllowReset(false)
      return
    }

    const resetToken = result.data?.user?.reset_token
    if (resetToken) {
      router.push(process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login/welcome?token=" + resetToken)
    }

    onNext()
  }

  const onSubmit = async () => {
    if (product === "free" || product === "freeinvestor") {
      return await handleSubmitFree()
    }
    await handleSubmit()
  }

  const isLoading = purchaseMutation.isPending || purchaseFreeMutation.isPending

  return (
    <div>
      <Table
        footer={
          <>
            <div className="flex gap-2 justify-between items-start">
              <strong>Monthly Charge</strong>
              <div className="text-xl font-bold">
                ${productPrice}
                <span className="text-caption">/mo</span>
              </div>
            </div>
            <div className="flex gap-2 justify-between items-start">
              <strong>Total Today</strong>
              <div className="text-price">${priceToday}</div>
            </div>
          </>
        }
      >
        <Row label="Name" value={formData.name} />
        <Row label="Email" value={formData.email} />
        <Row label="Phone" value={formData.phone} />
        <Row label="Plan" value={planName} />
      </Table>
      <GeneralConsent isChecked={isGeneralChecked} setIsChecked={setIsGeneralChecked} />
      <CommunicationConsent isChecked={isCommunicationChecked} setIsChecked={setIsCommunicationChecked} />
      <InvestorConsent data={formData} isChecked={isChecked} setIsChecked={setIsChecked} />
      <div className="w-100 flex justify-stretch items-stretch pt-4">
        <ThemeButton
          color="secondary"
          isDisabled={!isChecked || !isGeneralChecked}
          variant="full"
          isLoading={isLoading}
          onPress={onSubmit}
        >
          Sign Up
        </ThemeButton>
      </div>
    </div>
  )
}
