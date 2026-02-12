"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import type { ManageFormData } from "@/types/forms"
import type { User } from "@/types/api"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import useAnimateText from "@/hooks/useAnimateText"
import useAnimateContainer from "@/hooks/useAnimateContainer"

// Step components
import LoginEmailStep from "./steps/LoginEmailStep"
import LoginPasswordStep from "./steps/LoginPasswordStep"
import DashboardStep from "./steps/DashboardStep"
import ManageSubscriptionStep from "./steps/ManageSubscriptionStep"
import UpdateCardStep from "./steps/UpdateCardStep"

type ManageStep = "email" | "password" | "dashboard" | "subscription" | "card"

const stepConfig: Record<ManageStep, { title: string; description: string }> = {
  email: { title: "What is your Email?", description: "Use the Email you signed up with." },
  password: { title: "What is your Password?", description: "Enter your password to continue." },
  dashboard: { title: "Welcome back!", description: "What would you like to do?" },
  subscription: { title: "Manage Subscription", description: "View and update your subscription." },
  card: { title: "Update Card", description: "Update your billing information." },
}

export default function ManageFlow() {
  const [currentStep, setCurrentStep] = useState<ManageStep>("email")
  const [user, setUser] = useState<User | null>(null)
  const [allowReset, setAllowReset] = useState(true)

  const form = useForm<ManageFormData>({
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const goToStep = (step: ManageStep) => {
    setCurrentStep(step)
    setAllowReset(true)
  }

  const startStep: ManageStep = "email"

  const titleText = useAnimateText(stepConfig[currentStep]?.title || "", 0.5, 0, {
    name: user?.name || "",
  })
  const descriptionText = useAnimateText(stepConfig[currentStep]?.description || "", 0.5, 0.2)
  const containerRef = useAnimateContainer(currentStep)

  const renderStep = () => {
    switch (currentStep) {
      case "email":
        return <LoginEmailStep form={form} onNext={() => goToStep("password")} setAllowReset={setAllowReset} />
      case "password":
        return (
          <LoginPasswordStep
            form={form}
            onSuccess={(userData) => {
              setUser(userData)
              goToStep("dashboard")
            }}
            onBack={() => goToStep("email")}
            setAllowReset={setAllowReset}
          />
        )
      case "dashboard":
        return (
          <DashboardStep
            user={user!}
            onManageSubscription={() => goToStep("subscription")}
            onUpdateCard={() => goToStep("card")}
          />
        )
      case "subscription":
        return (
          <ManageSubscriptionStep
            user={user!}
            onBack={() => goToStep("dashboard")}
            onUpdateCard={() => goToStep("card")}
          />
        )
      case "card":
        return <UpdateCardStep user={user!} onBack={() => goToStep("dashboard")} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-[350px] w-full border-default-300 py-8 px-2 flex flex-col justify-between">
      <div className="rounded">
        <h2 className="h-[25px] text-default-700 text-lg font-bold">{titleText}</h2>
        <p className="h-[15px] my-1 text-sm text-default-700">{descriptionText}</p>
      </div>
      <div className="flex w-full gap-2 py-4" ref={containerRef}>
        {renderStep()}
      </div>
      <div className="flex gap-2">
        <div className="w-[100px]">
          <ThemeButton
            color="blur"
            className="w-full"
            isDisabled={!allowReset}
            onClick={() => {
              form.reset()
              setUser(null)
              setCurrentStep(startStep)
            }}
          >
            Start Over
          </ThemeButton>
        </div>
      </div>
    </div>
  )
}
