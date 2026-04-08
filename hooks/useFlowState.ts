import { useState } from "react"

export function useFlowState<TStep extends string>(transitionToStep: (step: TStep) => void) {
  const [allowReset, setAllowReset] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [returnStep, setReturnStep] = useState<TStep>("" as TStep)

  const goToStep = (step: TStep) => {
    transitionToStep(step)
    setAllowReset(true)
  }

  const goToError = (message: string, returnTo: TStep) => {
    setErrorMessage(message)
    setReturnStep(returnTo)
    transitionToStep("error" as TStep)
  }

  return { allowReset, setAllowReset, errorMessage, returnStep, goToStep, goToError }
}
