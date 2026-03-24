"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import Input from "@/components/UI/SignupForm/Input"
import getUniqueSlug from "@/components/utils/getUniqueSlug"
import { useProducts, isProductFree } from "@/providers/ProductProvider"
import { useWhitelabel } from "@/providers/WhitelabelProvider"

interface NameStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
  setAllowReset: (allow: boolean) => void
}

export default function NameStep({ form, onNext, onBack, setAllowReset }: NameStepProps) {
  const [isLoading, setIsLoading] = useState(false)
  const name = form.watch("name")
  const isDisabled = !name || name.length < 2

  const { currentWhitelabel } = useWhitelabel()
  const { getProductById } = useProducts({
    mode: "signup",
    whitelabel: currentWhitelabel?.code || "default",
  })
  const product = form.getValues("product")
  const selectedProduct = getProductById(product)
  const isInvestor = selectedProduct?.data?.user_config?.role === "INVESTOR"

  const handleSubmit = async () => {
    if (isDisabled) return

    // If investor or free plan, skip slug generation
    if (isInvestor || isProductFree(selectedProduct)) {
      onNext()
      return
    }

    setIsLoading(true)
    setAllowReset(false)

    try {
      const uniqueSlug = await getUniqueSlug(name)
      if (uniqueSlug) {
        form.setValue("slug", uniqueSlug)
      }
    } catch (error) {
      console.error("Error getting unique slug:", error)
    } finally {
      setIsLoading(false)
      setAllowReset(true)
      onNext()
    }
  }

  return (
    <Input
      placeholder="John Doe"
      name="name"
      value={name}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValue("name", e.target.value)}
      isDisabled={isDisabled}
      isLoading={isLoading}
      handleSubmit={handleSubmit}
    />
  )
}
