"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import axios from "axios"
import { Spinner } from "@/components/Theme/Spinner"
import type { User, Subscription, ApiResponse } from "@/types/api"
import type { Product } from "@/providers/ProductProvider"
import P from "@/components/Theme/P"
import { Card, CardBody } from "@/components/Theme/Card"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import { useProducts, isProductFree } from "@/providers/ProductProvider"
import Table from "@/components/Theme/Table"
import Row from "@/components/Theme/Row"
import formatDate from "@/components/utils/formatDate"

interface UpdatePlanStepProps {
  user: User
  onBack: () => void
  onSuccess: () => void
  onError: (message: string, title?: string, description?: string) => void
}

export default function UpdatePlanStep({ user, onBack, onSuccess, onError }: UpdatePlanStepProps) {
  const { products, loading: productsLoading } = useProducts({ mode: "manage" })
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
      if (json.success !== "success" || !json.data?.subscriptions?.[0]) {
        throw new Error("Failed to load subscription")
      }
      return json.data.subscriptions[0]
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
          subscription_id: currentSubscription.subscriptionId,
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
          subscription: {
            user_id: currentSubscription.userId,
            data: currentSubscription.data,
          },
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

  // Filter to subscription products, excluding current plan and free products
  const availablePlans = products.filter(
    (p: Product) =>
      p.product_type === "subscription" &&
      Number(p.product_id) !== Number(currentSubscription.productId) &&
      !isProductFree(p)
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
    const prorated = proratedInfo.proratedCost
    const proratedAmount = (prorated?.proratedAmount || 0) / 100
    const currentCost = (prorated?.currentPlanCost || 0) / 100
    const newCost = (prorated?.newPlanCost || 0) / 100
    const selectedProduct = proratedInfo.product || products.find((p: Product) => p.product_id === selectedProductId)
    const duration = prorated?.duration || "monthly"
    const isUpgrade = newCost > currentCost
    const percentRemaining = prorated?.percentOfTimeRemaining
      ? Math.round(prorated.percentOfTimeRemaining * 100)
      : null

    // Team size info — from product data (new plan) and checkplan response (current usage)
    const newTeamMax =
      selectedProduct?.data?.cashoffers?.user_config?.team_members
      ?? selectedProduct?.data?.user_config?.team_members
      ?? (selectedProduct?.data as any)?.team_members
      ?? null
    const currentTeamMax =
      currentSubscription?.data?.cashoffers?.user_config?.team_members
      ?? currentSubscription?.data?.user_config?.team_members
      ?? null
    const currentTeamCount = proratedInfo.numberOfUsers ?? null
    const hasTeamChange = newTeamMax !== null || currentTeamMax !== null

    return (
      <div className="w-full flex flex-col gap-4">
        <P>Review your plan change details below:</P>

        <Table
          footer={
            <div className="flex flex-col gap-3">
              {proratedAmount > 0 && (
                <p className="text-sm text-default-500">
                  A prorated charge of <strong>${proratedAmount.toFixed(2)}</strong> will be applied
                  today for the remainder of your current billing period.
                  Your regular {duration} billing of ${newCost.toFixed(2)} begins on your next renewal date.
                </p>
              )}
              {proratedAmount === 0 && isUpgrade && (
                <p className="text-sm text-default-500">
                  No prorated charge today. Your new rate of ${newCost.toFixed(2)}/{duration} takes
                  effect on your next renewal date.
                </p>
              )}
              {proratedAmount === 0 && !isUpgrade && (
                <p className="text-sm text-default-500">
                  No charge today. Your new rate of ${newCost.toFixed(2)}/{duration} takes
                  effect on your next renewal date.
                </p>
              )}

              {hasTeamChange && currentTeamCount !== null && newTeamMax !== null && currentTeamCount > newTeamMax && (
                <p className="text-sm text-warning-600 font-medium">
                  Warning: You currently have {currentTeamCount} team members but the new plan
                  only supports up to {newTeamMax}. You may need to remove team members before switching.
                </p>
              )}

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
          }
        >
          <Row label="New Plan" value={selectedProduct?.product_name || "Unknown"} />
          <Row label="Current Rate" value={`$${currentCost.toFixed(2)} / ${duration}`} />
          <Row label="New Rate" value={`$${newCost.toFixed(2)} / ${duration}`} />
          {prorated?.renewalDate && (
            <Row label="Next Renewal" value={formatDate(prorated.renewalDate)} />
          )}
          {percentRemaining !== null && (
            <Row label="Billing Period Remaining" value={`${percentRemaining}%`} />
          )}
          {hasTeamChange && (
            <>
              {currentTeamMax !== null && (
                <Row label="Current Team Size" value={`Up to ${currentTeamMax} members`} />
              )}
              {newTeamMax !== null && (
                <Row label="New Team Size" value={`Up to ${newTeamMax} members`} />
              )}
              {currentTeamCount !== null && (
                <Row label="Active Team Members" value={`${currentTeamCount}`} />
              )}
            </>
          )}
          <Row
            label="Charge Today"
            value={proratedAmount > 0 ? `$${proratedAmount.toFixed(2)}` : "No charge"}
            variant="primary"
          />
        </Table>
      </div>
    )
  }

  // Show available plans
  return (
    <div className="w-full flex flex-col gap-4">
      <P>Select a new plan:</P>

      <div className="flex flex-col gap-2 md:flex-row">
        {availablePlans.map((product: Product) => {
          const price = product.data?.renewal_cost ? product.data.renewal_cost / 100 : product.price / 100
          const duration = product.data?.duration || "monthly"

          return (
            <Card
              key={product.product_id}
              isPressable
              className="w-full"
              isDisabled={checkingPlan}
              onPress={() => handleCheckPlan(Number(product.product_id))}
            >
              <CardBody className="p-4">
                <h5>{product.product_name}</h5>
                <p className="text-sm text-default-500 mt-1">
                  ${price.toFixed(2)} / {duration}
                </p>
                {product.data?.cashoffers?.user_config?.team_members && (
                  <p className="text-xs text-default-400 mt-1">Up to {product.data.cashoffers.user_config.team_members} team members</p>
                )}
              </CardBody>
            </Card>
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
