"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk"
import { Spinner } from "@/components/Theme/Spinner"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import P from "@/components/Theme/P"
import type { User, ApiResponse } from "@/types/api"
import type { Product } from "@/providers/ProductProvider"

interface EnrollmentStepProps {
  user: User
  onSuccess: () => void
  onBack: () => void
  onError: (message: string, title?: string, description?: string) => void
}

interface EnrollmentData {
  eligible: boolean
  product_category: string
  reason: string
  products: Product[]
}

type Phase = "products" | "card" | "processing" | "success"

export default function EnrollmentStep({ user, onSuccess, onBack, onError }: EnrollmentStepProps) {
  const [phase, setPhase] = useState<Phase>("products")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    data: enrollment,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["enrollment", user.user_id],
    queryFn: async () => {
      const { data: json } = await axios.get<ApiResponse<EnrollmentData>>("/api/manage/enrollment")
      if (json.success !== "success" || !json.data) {
        throw new Error((json as any).error || "Failed to check enrollment eligibility")
      }
      return json.data
    },
  })

  // Auto-select when there's only one active product (e.g., external_cashoffers)
  const activeProducts = enrollment?.products ?? []

  useEffect(() => {
    if (activeProducts.length === 1 && !selectedProduct && phase === "products") {
      setSelectedProduct(activeProducts[0])
      setPhase("card")
    }
  }, [activeProducts.length])

  if (isLoading) return <Spinner />

  if (error) {
    return (
      <div className="w-full flex flex-col gap-4">
        <P>Unable to determine your enrollment eligibility. Please try again.</P>
        <div className="w-[200px]">
          <ThemeButton color="primary" onPress={onBack}>
            Back
          </ThemeButton>
        </div>
      </div>
    )
  }

  if (!enrollment || activeProducts.length === 0) {
    return (
      <div className="w-full flex flex-col gap-4">
        <P>No plans are currently available for your account. Please contact support.</P>
        <div className="w-[200px]">
          <ThemeButton color="primary" onPress={onBack}>
            Back
          </ThemeButton>
        </div>
      </div>
    )
  }

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product)
    setPhase("card")
  }

  const handleCardTokenized = async (token: any) => {
    if (!selectedProduct) return

    setIsSubmitting(true)
    setPhase("processing")

    try {
      const { data: result } = await axios.post<ApiResponse<any>>("/api/purchase/existing", {
        product_id: selectedProduct.product_id,
        card_token: token.token,
        exp_month: token.details.card.expMonth,
        exp_year: token.details.card.expYear,
        cardholder_name: user.name || "Cardholder",
      })

      if (result.success === "success") {
        setPhase("success")
      } else {
        onError(
          (result as any).error || "Purchase failed. Please try again.",
          "Purchase Failed",
          "There was an issue processing your payment."
        )
      }
    } catch (err: any) {
      const message = err.response?.data?.error || "Purchase failed. Please try again."
      onError(message, "Purchase Failed", "There was an issue processing your payment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFree = selectedProduct
    ? (selectedProduct.data?.renewal_cost ?? selectedProduct.price) === 0 && !selectedProduct.data?.signup_fee
    : false

  // Phase: Processing
  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Spinner />
        <P>{isFree ? "Activating your account..." : "Processing your payment..."}</P>
      </div>
    )
  }

  // Phase: Success
  if (phase === "success") {
    return (
      <div className="w-full flex flex-col gap-4">
        <P>Your subscription has been activated successfully!</P>
        <div className="w-[200px]">
          <ThemeButton color="primary" onPress={onSuccess}>
            Continue
          </ThemeButton>
        </div>
      </div>
    )
  }

  // Phase: Card input
  if (phase === "card" && selectedProduct) {
    const renewalCost = selectedProduct.data?.renewal_cost ?? selectedProduct.price
    const price = renewalCost / 100
    const durationRaw = selectedProduct.data?.duration || "monthly"
    const period = durationRaw.replace(/ly$/, "")
    const productIsFree = price === 0 && !selectedProduct.data?.signup_fee

      const buttonProps = {
      style: {
        backgroundColor: "var(--color-primary)",
        borderRadius: "0.5rem",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
    }

    const baseContacts = selectedProduct.data?.homeuptick?.base_contacts ?? 500
    const pricePerTier = (selectedProduct.data?.homeuptick?.price_per_tier ?? 7500) / 100
    const contactsPerTier = selectedProduct.data?.homeuptick?.contacts_per_tier ?? 1000

    return (
      <div className="w-full flex flex-col gap-4">
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
          <h4 className="font-semibold text-lg">{selectedProduct.product_name}</h4>
          <p className="text-sm text-gray-600">
            {productIsFree ? "Free" : `$${price.toFixed(2)} / ${period}`}
          </p>
          <div className="text-sm text-gray-600 border-t border-primary/30 pt-2 mt-2 space-y-1">
            <p>
              <span className="font-medium text-sm text-gray-700">Included:</span> {baseContacts.toLocaleString()}{" "}
              contacts
            </p>
            <p>
              <span className="font-medium text-sm text-gray-700">Overage:</span> ${pricePerTier} / {period} per
              additional {contactsPerTier.toLocaleString()} contacts
            </p>
          </div>
        </div>

        <PaymentForm
          applicationId={process.env.NEXT_PUBLIC_SQUARE_APP_ID!}
          locationId={process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!}
          cardTokenizeResponseReceived={handleCardTokenized}
        >
          <CreditCard
            render={(Button: any) => (
              <Button {...buttonProps}>
                {isSubmitting ? "Processing..." : productIsFree ? "Activate" : "Subscribe"}
              </Button>
            )}
          />
        </PaymentForm>

        <div className="w-[200px]">
          <ThemeButton
            color="secondary"
            onPress={() => {
              setPhase("products")
              setSelectedProduct(null)
            }}
          >
            Back
          </ThemeButton>
        </div>
      </div>
    )
  }

  // Phase: Product selection (default)
  return (
    <div className="w-full flex flex-col gap-4">
      <P>Select a plan to get started:</P>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeProducts.map((product: Product) => {
          const price = product.data?.renewal_cost ? product.data.renewal_cost / 100 : product.price / 100
          const duration = product.data?.duration || "monthly"

          return (
            <div
              key={product.product_id}
              className="p-4 border rounded-lg hover:border-primary cursor-pointer transition"
              onClick={() => handleSelectProduct(product)}
            >
              <h4 className="font-semibold text-lg">{product.product_name}</h4>
              <p className="text-gray-600 text-sm mt-1">
                ${price.toFixed(2)} / {duration}
              </p>
              {product.data?.cashoffers?.user_config?.team_members && (
                <p className="text-gray-500 text-xs mt-1">Up to {product.data.cashoffers.user_config.team_members} team members</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="w-[200px]">
        <ThemeButton color="secondary" onPress={onBack}>
          Back
        </ThemeButton>
      </div>
    </div>
  )
}
