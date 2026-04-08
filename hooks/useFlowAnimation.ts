import { type RefObject } from "react"
import useAnimateText from "@/hooks/useAnimateText"
import useAnimateContainer from "@/hooks/useAnimateContainer"
import useStepTransition from "@/hooks/useStepTransition"

interface AnimationTiming {
  speed: number
  delay: number
}

interface FlowAnimationOptions {
  title?: AnimationTiming
  description?: AnimationTiming
}

const DEFAULT_ANIMATION: Required<FlowAnimationOptions> = {
  title: { speed: 0.6, delay: 0.2 },
  description: { speed: 0.8, delay: 0.5 },
}

interface FlowAnimationResult<TStep extends string> {
  displayStep: TStep
  isTransitioning: boolean
  transitionToStep: (step: TStep) => void
  titleText: string
  descriptionText: string
  containerRef: RefObject<HTMLDivElement | null>
}

/**
 * Combines step transition and all animation hooks for a flow component.
 * Manages the step lifecycle and animates the title, description, and container.
 */
export function useFlowAnimation<TStep extends string>(
  initialStep: TStep,
  stepConfig: Record<string, { title: string; description: string }>,
  titleReplacements: Record<string, string>,
  options?: FlowAnimationOptions
): FlowAnimationResult<TStep> {
  const { displayStep, isTransitioning, transitionToStep } = useStepTransition<TStep>(initialStep)

  const titleTiming = options?.title ?? DEFAULT_ANIMATION.title
  const descTiming = options?.description ?? DEFAULT_ANIMATION.description

  const titleText = useAnimateText(
    stepConfig[displayStep]?.title ?? "",
    titleTiming.speed,
    titleTiming.delay,
    titleReplacements,
    isTransitioning
  )

  const descriptionText = useAnimateText(
    stepConfig[displayStep]?.description ?? "",
    descTiming.speed,
    descTiming.delay,
    {},
    isTransitioning
  )

  const containerRef = useAnimateContainer(displayStep, isTransitioning)

  return { displayStep, isTransitioning, transitionToStep, titleText, descriptionText, containerRef }
}
