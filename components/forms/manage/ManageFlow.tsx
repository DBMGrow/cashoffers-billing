"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import type { ManageFormData } from "@/types/forms"
import type { User } from "@/types/api"
import useAnimateText from "@/hooks/useAnimateText"
import useAnimateContainer from "@/hooks/useAnimateContainer"
import useStepTransition from "@/hooks/useStepTransition"
import FlowWrapper from "../FlowWrapper"

// Step components
import LoginEmailStep from "./steps/LoginEmailStep"
import LoginPasswordStep from "./steps/LoginPasswordStep"
import DashboardStep from "./steps/DashboardStep"
import ManageSubscriptionStep from "./steps/ManageSubscriptionStep"
import UpdateCardStep from "./steps/UpdateCardStep"
import UpdatePlanStep from "./steps/UpdatePlanStep"
import ErrorStep from "./steps/ErrorStep"

type ManageStep = "email" | "password" | "dashboard" | "subscription" | "card" | "changePlan" | "error"

const stepConfig: Record<ManageStep, { title: string; description: string }> = {
  email: { title: "What is your Email?", description: "Use the Email you signed up with." },
  password: { title: "What is your Password?", description: "Enter your password to continue." },
  dashboard: { title: "Welcome back!", description: "What would you like to do?" },
  subscription: { title: "Manage Subscription", description: "View and update your subscription." },
  card: { title: "Update Card", description: "Update your billing information." },
  changePlan: { title: "Change Plan", description: "Select a new plan for your subscription." },
  error: { title: "Oops!", description: "Something went wrong." },
}

export default function ManageFlow() {
  const { displayStep, isTransitioning, transitionToStep } = useStepTransition<ManageStep>("email")
  const [user, setUser] = useState<User | null>(null)
  const [allowReset, setAllowReset] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [returnStep, setReturnStep] = useState<ManageStep>("email")

  const form = useForm<ManageFormData>({
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const goToStep = (step: ManageStep) => {
    transitionToStep(step)
    setAllowReset(true)
  }

  const goToError = (message: string, returnTo: ManageStep) => {
    setErrorMessage(message)
    setReturnStep(returnTo)
    transitionToStep("error")
  }

  const startStep: ManageStep = "email"

  const userName = user?.name || ""
  const titleReplacements = useMemo(() => ({ name: userName }), [userName])

  const titleText = useAnimateText(
    stepConfig[displayStep]?.title || "",
    5,
    0,
    titleReplacements,
    isTransitioning
  )
  const descriptionText = useAnimateText(
    stepConfig[displayStep]?.description || "",
    2,
    0.2,
    {},
    isTransitioning
  )
  const containerRef = useAnimateContainer(displayStep, isTransitioning)

  const renderStep = () => {
    switch (displayStep) {
      case "email":
        return (
          <LoginEmailStep
            form={form}
            onNext={() => goToStep("password")}
            onError={(message) => goToError(message, "email")}
            setAllowReset={setAllowReset}
          />
        )
      case "password":
        return (
          <LoginPasswordStep
            form={form}
            onSuccess={(userData) => {
              setUser(userData)
              goToStep("dashboard")
            }}
            onBack={() => goToStep("email")}
            onError={(message) => goToError(message, "password")}
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
            onChangePlan={() => goToStep("changePlan")}
          />
        )
      case "card":
        return (
          <UpdateCardStep
            user={user!}
            onBack={() => goToStep("dashboard")}
            onError={(message) => goToError(message, "card")}
          />
        )
      case "changePlan":
        return (
          <UpdatePlanStep
            user={user!}
            onBack={() => goToStep("subscription")}
            onSuccess={() => goToStep("subscription")}
            onError={(message) => goToError(message, "changePlan")}
          />
        )
      case "error":
        return <ErrorStep errorMessage={errorMessage} onRetry={() => goToStep(returnStep)} />
      default:
        return null
    }
  }

  return (
    <FlowWrapper
      titleText={titleText}
      descriptionText={descriptionText}
      containerRef={containerRef}
      allowReset={allowReset}
      onReset={() => {
        form.reset()
        setUser(null)
        transitionToStep(startStep)
      }}
      minHeight="350px"
    >
      {renderStep()}
    </FlowWrapper>
  )
}
