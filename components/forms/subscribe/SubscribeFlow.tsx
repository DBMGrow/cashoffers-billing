"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { SubscribeFormData, FormStep, WhitelabelType } from "@/types/forms"
import { FlowDevTools, type DevPreset } from "@/components/dev/FlowDevTools"
import { useFlowAnimation } from "@/hooks/useFlowAnimation"
import { useFlowState } from "@/hooks/useFlowState"
import FlowWrapper from "../FlowWrapper"
import { useProducts, isProductFree } from "@/providers/ProductProvider"
import { useWhitelabel } from "@/providers/WhitelabelProvider"

// Step components
import EmailStep from "./steps/EmailStep"
import NameStep from "./steps/NameStep"
import SlugStep from "./steps/SlugStep"
import BrokerStep from "./steps/BrokerStep"
import TeamStep from "./steps/TeamStep"
import PhoneStep from "./steps/PhoneStep"
import CardStep from "./steps/CardStep"
import ReviewStep from "./steps/ReviewStep"
import WelcomeStep from "./steps/WelcomeStep"
import ErrorStep from "./steps/ErrorStep"
import OfferDowngradeStep from "./steps/OfferDowngradeStep"
import OfferDowngradeConfirmStep from "./steps/OfferDowngradeConfirmStep"

const cardDataSchema = z.object({
  token: z.string(),
  details: z.object({
    card: z.object({
      expMonth: z.number(),
      expYear: z.number(),
      brand: z.string(),
      lastFourDigits: z.string(),
    }),
  }),
})

const subscribeSchema = z.object({
  product: z.union([z.number(), z.literal("free"), z.literal("freeinvestor")]),
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().min(10),
  slug: z.string().nullable(),
  name_broker: z.string().nullable(),
  name_team: z.string().nullable(),
  coupon: z.string().nullable(),
  cardData: cardDataSchema.nullable(),
})

interface SubscribeFlowProps {
  initialProduct: number | "free" | "freeinvestor"
  whitelabel: WhitelabelType
  coupon?: string | null
  mockPurchase?: boolean
}

const BASE_STEP_CONFIG: Record<FormStep, { title: string; description: string }> = {
  plan: { title: "Select a Plan.", description: "Choose a plan that's right for you." },
  email: {
    title: "What is your Email?",
    description: "You'll use this email to log in. You can change it later if you need to.",
  },
  name: {
    title: "What is your Name?",
    description: "Enter your name how you would like it to show up to your clients.",
  },
  slug: {
    title: "Please choose a Domain Prefix.",
    description: "This will be the consumer facing website URL that you can use instantly to generate leads.",
  },
  broker: { title: "What is your Brokerage?", description: "Enter your Brokerage name." },
  team: { title: "What is your Team Name? (Optional)", description: "Enter your Team name." },
  phone: { title: "What is your Phone Number?", description: "You can change this later." },
  card: {
    title: "What Card would you like to use?",
    description: "This card will be saved on file for your subscription.",
  },
  review: { title: "Review.", description: "How does everything look?" },
  welcome: {
    title: "Welcome to CashOffers.PRO",
    description: "Congrats! All you need to do now is set your password.",
  },
  error: { title: "Oops!", description: "Something went wrong." },
  offerDowngrade: {
    title: "Reactivate Your Account",
    description: "Let's get you back on track.",
  },
  offerDowngradeConfirm: {
    title: "Check Your Email",
    description: "We've sent you a reactivation link.",
  },
}

const SUBSCRIBE_STEPS: readonly FormStep[] = [
  "email",
  "name",
  "slug",
  "broker",
  "team",
  "phone",
  "card",
  "review",
  "welcome",
  "offerDowngrade",
  "offerDowngradeConfirm",
  "error",
]

const devPresets: DevPreset<SubscribeFormData>[] = [
  { label: "→ Name", step: "name" },
  { label: "→ Phone", step: "phone" },
  { label: "→ Card", step: "card" },
  { label: "→ Review", step: "review" },
  { label: "→ Welcome", step: "welcome" },
  { label: "→ Error", step: "error" },
]

export default function SubscribeFlow({
  initialProduct,
  whitelabel,
  coupon,
  mockPurchase = false,
}: SubscribeFlowProps) {
  const [productValidated, setProductValidated] = useState(false)

  // Fetch products using TanStack Query
  const { currentWhitelabel } = useWhitelabel()

  const { getProductById, loading } = useProducts({
    mode: "signup",
    whitelabel: whitelabel || "default",
  })

  const selectedProduct = getProductById(initialProduct)

  let name_broker: string | null = null
  if (whitelabel === "kw") {
    name_broker = "Keller Williams"
  }

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    mode: "onChange",
    defaultValues: {
      product: initialProduct,
      email: "",
      name: "",
      phone: "",
      slug: null,
      name_broker,
      name_team: null,
      coupon,
      cardData: null,
    },
  })

  const isInvestor = (selectedProduct?.data?.cashoffers?.user_config?.role ?? selectedProduct?.data?.user_config?.role) === "INVESTOR"
  const isHomeUptickOnly = selectedProduct?.product_category === "homeuptick_only"

  const userName = form.watch("name")
  const titleReplacements = useMemo(() => ({ name: userName }), [userName])

  const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined)
  const [errorDescription, setErrorDescription] = useState<string | undefined>(undefined)

  const stepConfig = useMemo(
    () => ({
      ...BASE_STEP_CONFIG,
      error: {
        title: errorTitle ?? BASE_STEP_CONFIG.error.title,
        description: errorDescription ?? BASE_STEP_CONFIG.error.description,
      },
    }),
    [errorTitle, errorDescription]
  )

  const { displayStep, transitionToStep, titleText, descriptionText, containerRef } = useFlowAnimation<FormStep>(
    "email",
    stepConfig,
    titleReplacements
  )
  const {
    allowReset,
    setAllowReset,
    errorMessage,
    returnStep,
    goToStep,
    goToError: _goToError,
  } = useFlowState<FormStep>(transitionToStep)

  const goToError = (message: string, returnTo: FormStep, title?: string, description?: string) => {
    setErrorTitle(title)
    setErrorDescription(description)
    _goToError(message, returnTo)
  }

  // Check if product is invalid after products load
  useEffect(() => {
    if (!loading && !productValidated) {
      if (!selectedProduct) {
        setAllowReset(false)
        goToError("Invalid product ID. The product you selected could not be found.", "email")
      }
      setProductValidated(true)
    }
  }, [loading, selectedProduct, initialProduct, productValidated, setAllowReset, goToError])

  const renderStep = () => {
    switch (displayStep) {
      case "email":
        return (
          <EmailStep
            form={form}
            onNext={() => goToStep("name")}
            onOfferDowngrade={() => goToStep("offerDowngrade")}
            onError={(message, title, description) => goToError(message, "email", title, description)}
            setAllowReset={setAllowReset}
          />
        )
      case "name":
        return (
          <NameStep
            form={form}
            onNext={() => {
              if (isInvestor || isProductFree(selectedProduct)) {
                return goToStep("phone")
              }

              if (isHomeUptickOnly) {
                return goToStep("broker")
              }

              return goToStep("slug")
            }}
            onBack={() => goToStep("email")}
            setAllowReset={setAllowReset}
          />
        )
      case "slug":
        return (
          <SlugStep
            form={form}
            onNext={() => {
              if (whitelabel === "kw") return goToStep("team")
              return goToStep("broker")
            }}
            onBack={() => goToStep("name")}
            onError={(message) => goToError(message, "slug")}
            setAllowReset={setAllowReset}
          />
        )
      case "broker":
        return <BrokerStep form={form} onNext={() => goToStep("team")} onBack={() => goToStep(isHomeUptickOnly ? "name" : "slug")} />
      case "team":
        return <TeamStep form={form} onNext={() => goToStep("phone")} onBack={() => goToStep("broker")} />
      case "phone":
        return (
          <PhoneStep
            form={form}
            onNext={() => {
              // Skip card step for free products or when using mock purchase
              if (isProductFree(selectedProduct) || mockPurchase) {
                return goToStep("review")
              }
              return goToStep("card")
            }}
            onBack={() => goToStep("team")}
          />
        )
      case "card":
        return <CardStep form={form} onNext={() => goToStep("review")} onBack={() => goToStep("phone")} />
      case "review":
        return (
          <ReviewStep
            form={form}
            mockPurchase={mockPurchase}
            whitelabel={whitelabel || "default"}
            onNext={() => goToStep("welcome")}
            onBack={() => goToStep("card")}
            onError={(message) => goToError(message, "review")}
            onCardError={(message) => {
              form.setValue("cardData", null)
              setAllowReset(true)
              goToError(message, "card")
            }}
            setAllowReset={setAllowReset}
          />
        )
      case "welcome":
        return <WelcomeStep form={form} />
      case "error":
        return (
          <ErrorStep
            errorMessage={errorMessage}
            onRetry={() => goToStep(returnStep)}
            retryHref={!allowReset ? currentWhitelabel?.marketing_website : null}
          />
        )
      case "offerDowngrade":
        return (
          <OfferDowngradeStep
            form={form}
            onNext={() => goToStep("offerDowngradeConfirm")}
            onError={(message) => goToError(message, "offerDowngrade")}
            setAllowReset={setAllowReset}
          />
        )
      case "offerDowngradeConfirm":
        return <OfferDowngradeConfirmStep form={form} />
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
          transitionToStep("email")
        }}
      >
        {renderStep()}
      </FlowWrapper>
      <FlowDevTools
        flowName="Subscribe"
        currentStep={displayStep}
        steps={SUBSCRIBE_STEPS}
        onGoToStep={goToStep}
        form={form}
        presets={devPresets}
      />
    </>
  )
}
