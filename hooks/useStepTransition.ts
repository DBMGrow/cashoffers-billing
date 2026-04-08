"use client"

import { useState, useRef, useCallback } from "react"

export type FormStep = string

interface UseStepTransitionResult<T extends FormStep> {
  displayStep: T
  isTransitioning: boolean
  transitionToStep: (newStep: T) => void
}

export default function useStepTransition<T extends FormStep>(
  initialStep: T
): UseStepTransitionResult<T> {
  const [displayStep, setDisplayStep] = useState<T>(initialStep)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const transitionToStep = useCallback((newStep: T) => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
    }

    // Start transition
    setIsTransitioning(true)

    // Wait for out animation to complete (300ms), then update step
    transitionTimeoutRef.current = setTimeout(() => {
      setDisplayStep(newStep)
      setIsTransitioning(false)
    }, 300)
  }, [])

  return {
    displayStep,
    isTransitioning,
    transitionToStep,
  }
}
