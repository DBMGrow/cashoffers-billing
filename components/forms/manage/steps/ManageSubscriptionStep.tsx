"use client"

import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { Spinner } from "@/components/Theme/Spinner"
import type { User, Subscription, ApiResponse } from "@/types/api"
import P from "@/components/Theme/P"
import Table from "@/components/Theme/Table"
import Row from "@/components/Theme/Row"
import formatDate from "@/components/utils/formatDate"
import { ThemeButton } from "@/components/Theme/ThemeButton"

interface ManageSubscriptionStepProps {
  user: User
  onBack: () => void
  onUpdateCard: () => void
  onChangePlan: () => void
}

export default function ManageSubscriptionStep({ user, onBack, onUpdateCard, onChangePlan }: ManageSubscriptionStepProps) {
  const { data, error, isLoading } = useQuery({
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

  if (error) {
    console.error(error)
    return <P>There was an error loading your subscription</P>
  }

  if (isLoading) return <Spinner />

  if (!data) return <P>We couldn&apos;t find your subscription.</P>

  const subscriptionAmount = data.data?.renewal_cost ? data.data.renewal_cost / 100 : 0
  const teamSize = data.data?.team_members || null

  return (
    <div className="w-full flex flex-col">
      <Table footer={
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex flex-col grow">
              <ThemeButton color="secondary" onPress={onChangePlan}>
                Change Plan
              </ThemeButton>
            </div>
            <div className="flex flex-col grow">
              <ThemeButton color="secondary" onPress={onUpdateCard}>
                Update Card
              </ThemeButton>
            </div>
          </div>
          <div className="w-full">
            <ThemeButton color="primary" onPress={onBack}>
              Back
            </ThemeButton>
          </div>
        </div>
      }>
        <Row label="Plan" value={data.subscription_name} />
        {teamSize && <Row label="Team Size" value={`${teamSize} members`} />}
        <Row label="Amount" value={`$${subscriptionAmount} ${data.duration || "monthly"}`} />
        <Row label="Start Date" value={formatDate(data.createdAt)} />
        <Row label="Renews On" value={formatDate(data.renewal_date)} />
        <Row label="Status" value={data.status || "Active"} />
      </Table>
    </div>
  )
}
