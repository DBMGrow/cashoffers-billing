import { ThemeButton } from "@/components/Theme/ThemeButton"
import { useRef, useEffect } from "react"

interface InputProps {
  placeholder: string
  type?: string
  handleSubmit?: () => void
  isDisabled?: boolean
  /** Tooltip shown when hovering the disabled Next button, explaining why it's disabled */
  disabledReason?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  isLoading?: boolean
  name?: string
  testId?: string
}

export default function Input({
  placeholder,
  type = "text",
  handleSubmit,
  isDisabled,
  disabledReason,
  value,
  onChange,
  isLoading,
  name,
  testId,
}: InputProps) {
  handleSubmit = handleSubmit || (() => console.warn("No handleSubmit provided"))
  const ref = useRef<HTMLInputElement>(null)

  const inputProps = {
    className:
      "border-b-4 bg-transparent py-1 placeholder:text-default-400 grow border-default-300 text-3xl font-medium focus:outline-none focus:ring-0",
    type,
    placeholder,
    ref,
    value,
    onChange,
    name,
    "data-testid": testId || name || "form-input",
  }

  // focus on after 0.5 seconds
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled && ref.current) {
        ref.current.focus()
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // handle enter key on ref
  useEffect(() => {
    const current = ref.current

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !isDisabled) {
        handleSubmit()
      }
    }

    if (!current) return
    current.addEventListener("keydown", handleEnter)

    return () => current.removeEventListener("keydown", handleEnter)
  }, [handleSubmit, isDisabled])

  return (
    <>
      <div className="flex flex-col items-stretch grow gap-2 md:items-end md:flex-row">
        <input {...inputProps} />
        {/* The span carries the tooltip too — a disabled button doesn't get hover in every browser */}
        <span title={isDisabled ? disabledReason : undefined} className="flex flex-col items-stretch md:items-end">
          <ThemeButton
            color="primary"
            onPress={handleSubmit}
            isDisabled={isDisabled}
            isLoading={isLoading}
            title={isDisabled ? disabledReason : undefined}
            data-testid="next-button"
          >
            Next
          </ThemeButton>
        </span>
      </div>
    </>
  )
}
