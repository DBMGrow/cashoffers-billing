"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData, CardData } from "@/types/forms"
import type { Product } from "@/types/products"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import { usePurchase } from "@/hooks/api/usePurchase"
import { usePurchaseFree } from "@/hooks/api/usePurchaseFree"
import { products } from "@/components/data/productsList"
import { productsInvestor } from "@/components/data/productsListInvestor"
import Row from "@/components/Theme/Row"
import Table from "@/components/Theme/Table"
import InvestorConsent from "@/components/UI/SignupForm/InvestorConsent"
import GeneralConsent from "@/components/UI/SignupForm/GeneralConsent"
import CommunicationConsent from "@/components/UI/SignupForm/CommunicationConsent"
import { useRouter } from "next/navigation"

interface ReviewStepProps {
  form: UseFormReturn<SubscribeFormData>
  cardData: CardData | null
  onNext: () => void
  onBack: () => void
  onError: (message: string) => void
  setAllowReset: (allow: boolean) => void
}

export default function ReviewStep({ form, cardData, onNext, onBack, onError, setAllowReset }: ReviewStepProps) {
  const router = useRouter()
  const formData = form.watch()
  const product = formData.product
  const isInvestorProduct = product === 11 || product === "freeinvestor"

  const [isChecked, setIsChecked] = useState(!isInvestorProduct)
  const [isGeneralChecked, setIsGeneralChecked] = useState(false)
  const [isCommunicationChecked, setIsCommunicationChecked] = useState(false)

  const purchaseMutation = usePurchase()
  const purchaseFreeMutation = usePurchaseFree()

  const ourProducts = isInvestorProduct ? productsInvestor : products
  const productInfo: Product | undefined = ourProducts.find((p: any) => p.productID === product) as Product | undefined
  const planName = productInfo?.listName || "Unknown Plan"

  let signupFee = !!productInfo?.signup
  if (formData.coupon === "CPStart" || product === 12) signupFee = false

  const productPrice = productInfo ? productInfo.price / 100 : 0
  const priceToday = signupFee ? productPrice + 250 : productPrice

  const handleSubmitFree = async () => {
    setAllowReset(false)

    const result = await purchaseFreeMutation.mutateAsync({
      email: formData.email,
      phone: formData.phone,
      name: formData.name,
      name_broker: formData.name_broker,
      name_team: formData.name_team,
      whitelabel: formData.whitelabel,
      slug: formData.slug,
      isInvestor: product === "freeinvestor" ? 1 : 0,
    })

    if (result.success !== "success") {
      onError("Error creating account. Please try again.")
      setAllowReset(true)
      return
    }

    const resetToken = result.data?.user?.reset_token
    if (resetToken) {
      router.push(process.env.NEXT_PUBLIC_DASHBOARD_URL + "/login/welcome?token=" + resetToken)
    }

    onNext()
  }

  const handleSubmit = async () => {
    if (!cardData) {
      onError("Please add a card.")
      return
    }

    setAllowReset(false)

    let url = ""
    try {
      url = window.location.href
    } catch (error) {}

    const result = await purchaseMutation.mutateAsync({
      product_id: product,
      email: formData.email,
      phone: formData.phone,
      name: formData.name,
      card_token: cardData.token,
      exp_month: cardData.details.card.expMonth,
      exp_year: cardData.details.card.expYear,
      cardholder_name: formData.name,
      name_broker: formData.name_broker,
      name_team: formData.name_team,
      whitelabel: formData.whitelabel,
      slug: formData.slug,
      isInvestor: formData.isInvestor,
      url,
      coupon: formData.coupon,
    })

    if (result.code === "PUR08") {
      onError("We were unable to process your card. Please ensure your card information is correct.")
      setAllowReset(true)
      return
    }

    if (result.success !== "success") {
      onError("Error processing payment. Please try again.")
      setAllowReset(true)
      return
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
      <div className="w-[400px] flex justify-stretch items-stretch pt-4">
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
