"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { SubscribeFormData, FormStep, WhitelabelType, CardData } from "@/types/forms"
import useAnimateText from "@/hooks/useAnimateText"
import useAnimateContainer from "@/hooks/useAnimateContainer"
import useStepTransition from "@/hooks/useStepTransition"
import FlowWrapper from "../FlowWrapper"
import { useProducts } from "@/providers/ProductProvider"

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

const subscribeSchema = z.object({
  product: z.union([z.number(), z.string()]),
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().min(10),
  slug: z.string().nullable(),
  name_broker: z.string().nullable(),
  name_team: z.string().nullable(),
  coupon: z.string().nullable(),
  whitelabel: z.string().nullable(),
  isInvestor: z.boolean(),
})

interface SubscribeFlowProps {
  initialProduct: number | string
  whitelabel: WhitelabelType
  coupon?: string | null
}

const stepConfig: Record<FormStep, { title: string; description: string }> = {
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

export default function SubscribeFlow({ initialProduct, whitelabel, coupon }: SubscribeFlowProps) {
  const { displayStep, isTransitioning, transitionToStep} = useStepTransition<FormStep>("email")
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [allowReset, setAllowReset] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [returnStep, setReturnStep] = useState<FormStep>("email")
  const [productValidated, setProductValidated] = useState(false)

  // Fetch products using TanStack Query
  const { getProductById, loading } = useProducts({
    mode: "signup",
    whitelabel: whitelabel || "default"
  })

  // Derive isInvestor from product data instead of hardcoding product ID
  const selectedProduct = getProductById(initialProduct)
  const isInvestor = selectedProduct?.data?.user_config?.role === "INVESTOR"

  // Check if product is invalid after products load
  useEffect(() => {
    if (!loading && !productValidated) {
      if (!selectedProduct && initialProduct !== "free" && initialProduct !== "freeinvestor") {
        setErrorMessage("Invalid product ID. The product you selected could not be found.")
        setReturnStep("email")
        setAllowReset(false)
        transitionToStep("error")
      }
      setProductValidated(true)
    }
  }, [loading, selectedProduct, initialProduct, productValidated, transitionToStep])

  const form = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    mode: "onChange",
    defaultValues: {
      product: initialProduct,
      email: "",
      name: "",
      phone: "",
      slug: null,
      name_broker: whitelabel === "kw" ? "Keller Williams" : null,
      name_team: null,
      coupon: coupon || null,
      whitelabel: whitelabel !== "default" ? whitelabel : null,
      isInvestor,
    },
  })

  const goToStep = (step: FormStep) => {
    transitionToStep(step)
    setAllowReset(true)
  }

  const goToError = (message: string, returnTo: FormStep) => {
    setErrorMessage(message)
    setReturnStep(returnTo)
    transitionToStep("error")
  }

  const startStep: FormStep = "email"

  const userName = form.watch("name")
  const titleReplacements = useMemo(() => ({ name: userName }), [userName])

  const titleText = useAnimateText(stepConfig[displayStep]?.title || "", 0.6, 0.2, titleReplacements, isTransitioning)
  const descriptionText = useAnimateText(stepConfig[displayStep]?.description || "", 0.8, 0.5, {}, isTransitioning)
  const containerRef = useAnimateContainer(displayStep, isTransitioning)

  const renderStep = () => {
    switch (displayStep) {
      case "email":
        return (
          <EmailStep
            form={form}
            onNext={() => goToStep("name")}
            onOfferDowngrade={() => goToStep("offerDowngrade")}
            onError={(message) => goToError(message, "email")}
            setAllowReset={setAllowReset}
          />
        )
      case "name":
        return (
          <NameStep
            form={form}
            onNext={() => {
              if (form.getValues("isInvestor")) return goToStep("phone")
              if (form.getValues("product") === "free" || form.getValues("product") === "freeinvestor")
                return goToStep("phone")
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
        return <BrokerStep form={form} onNext={() => goToStep("team")} onBack={() => goToStep("slug")} />
      case "team":
        return <TeamStep form={form} onNext={() => goToStep("phone")} onBack={() => goToStep("broker")} />
      case "phone":
        return (
          <PhoneStep
            form={form}
            onNext={() => {
              if (form.getValues("product") === "free" || form.getValues("product") === "freeinvestor")
                return goToStep("review")
              return goToStep("card")
            }}
            onBack={() => goToStep("team")}
          />
        )
      case "card":
        return (
          <CardStep
            form={form}
            cardData={cardData}
            setCardData={setCardData}
            onNext={() => goToStep("review")}
            onBack={() => goToStep("phone")}
          />
        )
      case "review":
        return (
          <ReviewStep
            form={form}
            cardData={cardData}
            onNext={() => goToStep("welcome")}
            onBack={() => goToStep("card")}
            onError={(message) => goToError(message, "review")}
            setAllowReset={setAllowReset}
          />
        )
      case "welcome":
        return <WelcomeStep form={form} />
      case "error":
        return <ErrorStep errorMessage={errorMessage} onRetry={() => goToStep(returnStep)} />
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
    <FlowWrapper
      titleText={titleText}
      descriptionText={descriptionText}
      containerRef={containerRef}
      allowReset={allowReset}
      onReset={() => {
        form.reset()
        transitionToStep(startStep)
      }}
    >
      {renderStep()}
    </FlowWrapper>
  )
}
