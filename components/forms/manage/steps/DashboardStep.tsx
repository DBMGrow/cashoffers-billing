"use client"

import { Card, CardBody } from "@/components/Theme/Card"
import {
  ArrowUturnLeftIcon,
  ArrowPathIcon,
  CreditCardIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline"
import type { User } from "@/types/api"
import { useRouter } from "next/navigation"
import ThemeButton from "@/components/Theme/ThemeButton"

interface DashboardStepProps {
  user: User
  onManageSubscription: () => void
  onUpdateCard: () => void
  onLogout: () => void
}

export default function DashboardStep({ user, onManageSubscription, onUpdateCard, onLogout }: DashboardStepProps) {
  const router = useRouter()

  const primaryOptions = [
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
  ]

  const secondaryOptions = [
    {
      title: "Return to Dashboard",
      icon: ArrowUturnLeftIcon,
      action: () => {
        router.push(process.env.NEXT_PUBLIC_DASHBOARD_URL!)
      },
    },
    {
      title: "Log Out",
      icon: ArrowRightStartOnRectangleIcon,
      action: onLogout,
    },
  ]

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col gap-2 md:flex-row">
        {primaryOptions.map((option, index) => (
          <Card key={index} isPressable className="w-full" onPress={option.action}>
            <CardBody className="p-4">
              <div className="w-full mb-2">
                <option.icon className="w-6 h-6 text-default-800" />
              </div>
              <h5>{option.title}</h5>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        {secondaryOptions.map((option, index) => (
          <ThemeButton color="secondary" key={index} innerClassName="flex gap-2 items-center" onPress={option.action}>
            <option.icon className="w-4 h-4 text-white" />
            {option.title}
          </ThemeButton>
        ))}
      </div>
    </div>
  )
}
