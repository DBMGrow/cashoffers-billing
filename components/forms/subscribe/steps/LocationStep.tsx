"use client"

import { useRef, useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import { ThemeButton } from "@/components/Theme/ThemeButton"

interface LocationStepProps {
  form: UseFormReturn<SubscribeFormData>
  onNext: () => void
  onBack: () => void
}

const inputClassName =
  "border-b-4 bg-transparent py-1 placeholder:text-default-400 grow border-default-300 text-3xl font-medium focus:outline-none focus:ring-0 min-w-0"

// Asks for City and State after the Team step; both are saved on the new user (CO-I240 / Desk #1440)
export default function LocationStep({ form, onNext, onBack }: LocationStepProps) {
  const city = form.watch("city") || ""
  const state = form.watch("state") || ""
  const isDisabled = !city.trim() || !state.trim()

  const cityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled && cityRef.current) cityRef.current.focus()
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = () => {
    if (isDisabled) return
    onNext()
  }

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isDisabled) handleSubmit()
  }

  return (
    <div className="flex flex-col items-stretch grow gap-2 md:items-end md:flex-row">
      {/* size={1} drops the input's intrinsic ~20-char width (huge at text-3xl, it pushed the
          Next button off the row) and lets flexbox size the fields instead */}
      <input
        className={inputClassName}
        type="text"
        size={1}
        placeholder="City"
        name="city"
        ref={cityRef}
        value={city}
        onChange={(e) => form.setValue("city", e.target.value)}
        onKeyDown={handleEnter}
        data-testid="city-input"
      />
      <input
        className={`${inputClassName} md:grow-0 md:w-36`}
        type="text"
        size={1}
        placeholder="State"
        name="state"
        value={state}
        onChange={(e) => form.setValue("state", e.target.value)}
        onKeyDown={handleEnter}
        data-testid="state-input"
      />
      <span
        title={isDisabled ? "Please enter your City and State" : undefined}
        className="flex flex-col items-stretch md:items-end"
      >
        <ThemeButton color="primary" onPress={handleSubmit} isDisabled={isDisabled} data-testid="next-button">
          Next
        </ThemeButton>
      </span>
    </div>
  )
}
