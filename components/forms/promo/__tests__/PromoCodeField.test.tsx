import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import PromoCodeField from "../PromoCodeField"

const quote = {
  valid: true as const,
  code: "EXPCON",
  display: "First month free",
  summary: "Promo EXPCON: First month free, $0.00 today, then $49.00/mo",
  original_amount: 4900,
  discount_amount: 4900,
  charged_amount: 0,
  then_amount: 4900,
}

describe("PromoCodeField", () => {
  it("shows the quote for an applied code, and Remove clears it", () => {
    const onChange = vi.fn()
    render(
      <PromoCodeField code="EXPCON" validation={{ quote, error: null }} isValidating={false} onChange={onChange} />
    )
    expect(screen.getByTestId("promo-summary").textContent).toBe(quote.summary)
    fireEvent.click(screen.getByText("Remove"))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("reveals the input on 'Have a promo code?' and applies the code uppercased", () => {
    const onChange = vi.fn()
    render(<PromoCodeField code={null} validation={undefined} isValidating={false} onChange={onChange} />)
    fireEvent.click(screen.getByText("Have a promo code?"))
    fireEvent.change(screen.getByLabelText("Promo code"), { target: { value: " expcon " } })
    fireEvent.click(screen.getByText("Apply"))
    expect(onChange).toHaveBeenCalledWith("EXPCON")
  })

  it("shows why a code was refused", () => {
    render(
      <PromoCodeField
        code="OLD"
        validation={{ quote: null, error: "That promo code has expired." }}
        isValidating={false}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole("alert").textContent).toBe("OLD: That promo code has expired.")
  })
})
