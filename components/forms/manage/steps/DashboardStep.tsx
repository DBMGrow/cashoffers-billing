"use client"

import { Card, CardBody } from "@/components/Theme/Card"
import { ArrowUturnLeftIcon, ArrowPathIcon, CreditCardIcon } from "@heroicons/react/24/outline"
import type { User } from "@/types/api"
import { useRouter } from "next/navigation"

interface DashboardStepProps {
  user: User
  onManageSubscription: () => void
  onUpdateCard: () => void
}

export default function DashboardStep({ user, onManageSubscription, onUpdateCard }: DashboardStepProps) {
  const router = useRouter()

  const options = [
    {
      title: "Update Your Billing Info",
      icon: CreditCardIcon,
      action: onUpdateCard,
    },
    {
      title: "Manage Your Subscription",
      icon: ArrowPathIcon,
      action: onManageSubscription,
    },
    {
      title: "Return to Dashboard",
      icon: ArrowUturnLeftIcon,
      action: () => {
        router.push(process.env.NEXT_PUBLIC_DASHBOARD_URL!)
      },
    },
  ]

  return (
    <div className="w-full flex flex-col gap-2 md:flex-row">
      {options.map((option, index) => (
        <Card key={index} isPressable className="w-full" onPress={option.action}>
          <CardBody className="p-4">
            <div className="w-full mb-2">
              <option.icon className="w-6 h-6 text-default-800" />
            </div>
            <h5 className="text-default-700">{option.title}</h5>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
