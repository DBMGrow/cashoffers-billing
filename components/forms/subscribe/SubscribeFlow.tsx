"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { SubscribeFormData, FormStep, WhitelabelType, CardData } from "@/types/forms"
import { ThemeButton } from "@/components/Theme/ThemeButton"
import useAnimateText from "@/hooks/useAnimateText"
import useAnimateContainer from "@/hooks/useAnimateContainer"

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
  email: { title: "What is your Email?", description: "You'll use this email to log in." },
  name: { title: "What is your Name?", description: "Enter your name how you would like it to show up to your clients." },
  slug: {
    title: "Please choose a Domain Prefix.",
    description: "This will be the consumer facing website URL that you can use instantly to generate leads.",
  },
  broker: { title: "What is your Brokerage?", description: "Enter your Brokerage name." },
  team: { title: "What is your Team Name? (Optional)", description: "Enter your Team name." },
  phone: { title: "What is your Phone Number?", description: "You can change this later." },
  card: { title: "What Card would you like to use?", description: "This card will be saved on file for your subscription." },
  review: { title: "Review.", description: "How does everything look?" },
  welcome: { title: "Welcome to CashOffers.PRO", description: "Congrats! All you need to do now is set your password." },
}

export default function SubscribeFlow({ initialProduct, whitelabel, coupon }: SubscribeFlowProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>("email")
  const [cardData, setCardData] = useState<CardData | null>(null)
  const [allowReset, setAllowReset] = useState(true)

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
      isInvestor: initialProduct === 11,
    },
  })

  const goToStep = (step: FormStep) => {
    setCurrentStep(step)
    setAllowReset(true)
  }

  const startStep: FormStep = "email"

  const titleText = useAnimateText(stepConfig[currentStep]?.title || "", 0.5, 0, {
    name: form.watch("name"),
  })
  const descriptionText = useAnimateText(stepConfig[currentStep]?.description || "", 0.5, 0.2)
  const containerRef = useAnimateContainer(currentStep)

  const renderStep = () => {
    switch (currentStep) {
      case "email":
        return <EmailStep form={form} onNext={() => goToStep("name")} setAllowReset={setAllowReset} />
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
            setAllowReset={setAllowReset}
          />
        )
      case "welcome":
        return <WelcomeStep form={form} />
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
