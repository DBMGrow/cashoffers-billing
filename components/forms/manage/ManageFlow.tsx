"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useSearchParams } from "next/navigation"
import type { ManageFormData } from "@/types/forms"
import { FlowDevTools, type DevPreset } from "@/components/dev/FlowDevTools"
import { useFlowAnimation } from "@/hooks/useFlowAnimation"
import { useFlowState } from "@/hooks/useFlowState"
import { useUser } from "@/hooks/useUser"
import { useSession } from "@/hooks/api/useSession"
import { Spinner } from "@/components/Theme/Spinner"
import FlowWrapper from "../FlowWrapper"

// Step components
import LoginEmailStep from "./steps/LoginEmailStep"
import LoginPasswordStep from "./steps/LoginPasswordStep"
import DashboardStep from "./steps/DashboardStep"
import ManageSubscriptionStep from "./steps/ManageSubscriptionStep"
import UpdateCardStep from "./steps/UpdateCardStep"
import UpdatePlanStep from "./steps/UpdatePlanStep"
import ErrorStep from "./steps/ErrorStep"

type ManageStep = "loading" | "email" | "password" | "dashboard" | "subscription" | "card" | "changePlan" | "error"

const MANAGE_STEPS: readonly ManageStep[] = [
  "loading",
  "email",
  "password",
  "dashboard",
  "subscription",
  "card",
  "changePlan",
  "error",
]

const GOTO_STEPS = new Set<ManageStep>(["dashboard", "subscription", "card", "changePlan"])

const devPresets: DevPreset<ManageFormData>[] = [
  { label: "→ Loading", step: "loading" },
  { label: "→ Password", step: "password" },
  { label: "→ Dashboard", step: "dashboard" },
  { label: "→ Error", step: "error" },
]

const BASE_STEP_CONFIG: Record<ManageStep, { title: string; description: string }> = {
  loading: { title: "", description: "" },
  email: { title: "What is your Email?", description: "Use the Email you signed up with." },
  password: { title: "What is your Password?", description: "Enter your password to continue." },
  dashboard: { title: "Welcome back!", description: "What would you like to do?" },
  subscription: { title: "Manage Subscription", description: "View and update your subscription." },
  card: { title: "Update Card", description: "Update your billing information." },
  changePlan: { title: "Change Plan", description: "Select a new plan for your subscription." },
  error: { title: "Oops!", description: "Something went wrong." },
}

export default function ManageFlow() {
  const { user, setUser } = useUser()
  const userName = user?.name || ""
  const titleReplacements = useMemo(() => ({ name: userName }), [userName])

  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined)
  const [errorDescription, setErrorDescription] = useState<string | undefined>(undefined)

  const stepConfig = useMemo(() => ({
    ...BASE_STEP_CONFIG,
    error: {
      title: errorTitle ?? BASE_STEP_CONFIG.error.title,
      description: errorDescription ?? BASE_STEP_CONFIG.error.description,
    },
  }), [errorTitle, errorDescription])

  const { displayStep, transitionToStep, titleText, descriptionText, containerRef } = useFlowAnimation<ManageStep>(
    "loading",
    stepConfig,
    titleReplacements
  )
  const { allowReset, setAllowReset, errorMessage, returnStep, goToStep, goToError: _goToError } =
    useFlowState<ManageStep>(transitionToStep)

  const goToError = (message: string, returnTo: ManageStep, title?: string, description?: string) => {
    setErrorTitle(title)
    setErrorDescription(description)
    _goToError(message, returnTo)
  }
  const searchParams = useSearchParams()
  const { data: sessionUser, isPending: isCheckingSession } = useSession()

  const form = useForm<ManageFormData>({
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Resolve where to navigate after a successful login
  const resolvePostLoginStep = (): ManageStep => {
    const goto = searchParams.get("goto") as ManageStep | null
    if (goto && GOTO_STEPS.has(goto)) return goto
    return "dashboard"
  }

  // On mount: check session, then route accordingly
  useEffect(() => {
    if (isCheckingSession) return

    if (sessionUser) {
      setUser(sessionUser)
      goToStep(resolvePostLoginStep())
    } else {
      setAllowReset(false)
      goToStep("email")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckingSession, sessionUser])

  const renderStep = () => {
    switch (displayStep) {
      case "loading":
        return (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )
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
              goToStep(resolvePostLoginStep())
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
    <>
      <FlowWrapper
        titleText={titleText}
        descriptionText={descriptionText}
        containerRef={containerRef}
        allowReset={allowReset}
        onReset={() => {
          form.reset()
          setUser(null)
          transitionToStep("email")
        }}
        minHeight="350px"
      >
        {renderStep()}
      </FlowWrapper>
      <FlowDevTools
        flowName="Manage"
        currentStep={displayStep}
        steps={MANAGE_STEPS}
        onGoToStep={goToStep}
        form={form}
        presets={devPresets}
      />
    </>
  )
}
