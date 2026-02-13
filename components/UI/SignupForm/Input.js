import { ThemeButton } from "@/components/Theme/ThemeButton"
import { useRef, useEffect } from "react"

export default function Input({ placeholder, type = "text", handleSubmit, isDisabled, value, onChange, isLoading }) {
  handleSubmit = handleSubmit || (() => console.warn("No handleSubmit provided"))
  const ref = useRef()

  const inputProps = {
    className:
      "border-b-4 bg-transparent py-1 placeholder:text-default-400 grow border-default-300 text-3xl font-medium focus:outline-none focus:ring-0",
    type,
    placeholder,
    ref,
    value,
    onChange,
  }

  // focus on after 0.5 seconds
  useEffect(() => {
    if (ref.current) {
      setTimeout(() => {
        ref.current.focus()
      }, 500)
    }
  }, [ref])

  // handle enter key on ref
  useEffect(() => {
    const current = ref.current

    const handleEnter = (e) => {
      if (e.key === "Enter" && !isDisabled) {
        handleSubmit()
      }
    }

    current.addEventListener("keydown", handleEnter)

    return () => current.removeEventListener("keydown", handleEnter)
  }, [handleSubmit, isDisabled])

  return (
    <>
      <div className="flex flex-col items-stretch grow gap-2 md:items-end md:flex-row">
        <input {...inputProps} />
        <ThemeButton color="primary" onPress={handleSubmit} isDisabled={isDisabled} isLoading={isLoading}>
          Next
        </ThemeButton>
      </div>
    </>
  )
}
