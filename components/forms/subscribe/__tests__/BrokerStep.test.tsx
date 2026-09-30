import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { SubscribeFormData } from "@/types/forms"
import BrokerStep, { defaultBrokerFor } from "../steps/BrokerStep"

function Harness({ whitelabel, onNext }: { whitelabel: string; onNext: (value: string | null) => void }) {
  const form = useForm<SubscribeFormData>({
    defaultValues: { name_broker: defaultBrokerFor(whitelabel) } as Partial<SubscribeFormData> as SubscribeFormData,
  })
  return <BrokerStep form={form} onNext={() => onNext(form.getValues("name_broker"))} onBack={vi.fn()} />
}

describe("defaultBrokerFor", () => {
  it("pre-fills eXp Realty for the ExpressOffers white label", () => {
    expect(defaultBrokerFor("EXP")).toBe("eXp Realty")
  })

  it("leaves every other white label empty", () => {
    expect(defaultBrokerFor("default")).toBeNull()
    expect(defaultBrokerFor("uco")).toBeNull()
    expect(defaultBrokerFor(null)).toBeNull()
    expect(defaultBrokerFor(undefined)).toBeNull()
  })
})

describe("BrokerStep", () => {
  it("shows eXp Realty as the value for ExpressOffers and submits it as is", () => {
    const onNext = vi.fn()
    render(<Harness whitelabel="EXP" onNext={onNext} />)
    const input = screen.getByTestId("name_broker") as HTMLInputElement
    expect(input.value).toBe("eXp Realty")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onNext).toHaveBeenCalledWith("eXp Realty")
  })

  it("keeps the placeholder and an empty value for other white labels", () => {
    render(<Harness whitelabel="default" onNext={vi.fn()} />)
    const input = screen.getByTestId("name_broker") as HTMLInputElement
    expect(input.value).toBe("")
    expect(input.placeholder).toBe("e.g. Keller Williams, RE/MAX")
  })
})
