"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import axios from "axios"
import { Spinner } from "@/components/Theme/Spinner"
import type { User, Subscription, Product, ApiResponse } from "@/types/api"
import P from "@/components/Theme/P"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import { useProducts } from "@/providers/ProductProvider"

interface UpdatePlanStepProps {
  user: User
  onBack: () => void
  onSuccess: () => void
  onError: (message: string) => void
}

export default function UpdatePlanStep({ user, onBack, onSuccess, onError }: UpdatePlanStepProps) {
  const { products, loading: productsLoading } = useProducts()
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [proratedInfo, setProratedInfo] = useState<any>(null)
  const [checkingPlan, setCheckingPlan] = useState(false)

  // Fetch current subscription
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription", user.api_token],
    queryFn: async () => {
      const { data: json } = await axios.get<ApiResponse<Subscription[]>>("/api/subscription/single", {
        headers: {
          "x-api-token": user.api_token,
        },
      })
      if (json.success !== "success" || !json.data?.[0]) {
        throw new Error("Failed to load subscription")
      }
      return json.data[0]
    },
  })

  if (subscriptionLoading || !currentSubscription) {
    return <Spinner />
  }

  const changePlanMutation = useMutation({
    mutationFn: async (productId: number) => {
      const { data } = await axios.post<ApiResponse<any>>(
        "/api/manage/purchase",
        {
          product_id: productId,
          subscription_id: currentSubscription.subscription_id,
        },
        {
          headers: {
            "x-api-token": user.api_token,
          },
        }
      )
      return data
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: any) => {
      onError(error.response?.data?.error || "Failed to change plan")
    },
  })

  const handleCheckPlan = async (productId: number) => {
    setCheckingPlan(true)
    setSelectedProductId(productId)

    try {
      const { data } = await axios.post<ApiResponse<any>>(
        "/api/manage/checkplan",
        {
          subscription: currentSubscription,
          productID: productId,
        },
        {
          headers: {
            "x-api-token": user.api_token,
          },
        }
      )

      if (data.success === "success") {
        setProratedInfo(data.data)
      } else {
        onError(data.error || "Failed to check plan")
        setSelectedProductId(null)
      }
    } catch (error: any) {
      if (error.response?.data?.code === "ROLE_INCOMPATIBLE") {
        onError("You cannot switch between AGENT and INVESTOR roles")
      } else {
        onError(error.response?.data?.error || "Failed to check plan")
      }
      setSelectedProductId(null)
    } finally {
      setCheckingPlan(false)
    }
  }

  const handleConfirmChange = () => {
    if (selectedProductId) {
      changePlanMutation.mutate(selectedProductId)
    }
  }

  if (productsLoading) return <Spinner />

  // Filter out current plan and free plans
  const availablePlans = products.filter(
    (p: Product) =>
      p.product_id !== currentSubscription.product_id &&
      p.product_id !== "free" &&
      p.product_id !== "freeinvestor" &&
      p.active === 1
  )

  if (availablePlans.length === 0) {
    return (
      <div className="w-full flex flex-col gap-4">
        <P>No other plans available for your account type.</P>
        <div className="w-[200px]">
          <ThemeButton color="primary" onPress={onBack}>
            Back
          </ThemeButton>
        </div>
      </div>
    )
  }

  // If a plan is selected, show confirmation
  if (selectedProductId && proratedInfo) {
    const proratedCost = proratedInfo.proratedCost / 100
    const selectedProduct = products.find((p: Product) => p.product_id === selectedProductId)

    return (
      <div className="w-full flex flex-col gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold mb-2">Confirm Plan Change</h3>
          <p className="text-sm">
            You are changing to: <strong>{selectedProduct?.product_name}</strong>
          </p>
          {proratedCost > 0 && (
            <p className="text-sm mt-2">
              Prorated charge today: <strong>${proratedCost.toFixed(2)}</strong>
            </p>
          )}
          {proratedCost === 0 && (
            <p className="text-sm mt-2 text-green-700">No charge today (downgrade or equal cost)</p>
          )}
        </div>

        <div className="flex gap-2">
          <ThemeButton
            color="primary"
            onPress={() => {
              setSelectedProductId(null)
              setProratedInfo(null)
            }}
            isDisabled={changePlanMutation.isPending}
          >
            Cancel
          </ThemeButton>
          <ThemeButton
            color="secondary"
            onPress={handleConfirmChange}
            isDisabled={changePlanMutation.isPending}
          >
            {changePlanMutation.isPending ? "Processing..." : "Confirm Change"}
          </ThemeButton>
        </div>
      </div>
    )
  }

  // Show available plans
  return (
    <div className="w-full flex flex-col gap-4">
      <P>Select a new plan:</P>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availablePlans.map((product: Product) => {
          const price = product.data?.renewal_cost ? product.data.renewal_cost / 100 : product.price / 100
          const duration = product.data?.duration || "monthly"

          return (
            <div
              key={product.product_id}
              className="p-4 border rounded-lg hover:border-blue-500 cursor-pointer transition"
              onClick={() => !checkingPlan && handleCheckPlan(Number(product.product_id))}
            >
              <h4 className="font-semibold text-lg">{product.product_name}</h4>
              <p className="text-gray-600 text-sm mt-1">
                ${price.toFixed(2)} / {duration}
              </p>
              {product.data?.team_members && (
                <p className="text-gray-500 text-xs mt-1">Up to {product.data.team_members} team members</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="w-[200px]">
        <ThemeButton color="primary" onPress={onBack} isDisabled={checkingPlan}>
          Back
        </ThemeButton>
      </div>
    </div>
  )
}
