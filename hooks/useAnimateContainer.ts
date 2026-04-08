"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"

export default function useAnimateContainer(displayStep: unknown, isTransitioning: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const timeline = useRef<gsap.core.Tween | null>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return

    // Kill any existing animation
    if (timeline.current) {
      timeline.current.kill()
    }

    // First render: just fade in with delay
    if (isFirstRender.current) {
      gsap.set(containerRef.current, {
        opacity: 0,
        y: -5,
      })

      timeline.current = gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        delay: 0.5,
        ease: "power2.out",
      })

      isFirstRender.current = false
      return
    }

    // If transitioning, animate out
    if (isTransitioning) {
      timeline.current = gsap.to(containerRef.current, {
        opacity: 0,
        y: 5,
        duration: 0.3,
        ease: "power2.in",
      })
    } else {
      // Not transitioning anymore, animate in
      gsap.set(containerRef.current, {
        opacity: 0,
        y: -5,
      })

      timeline.current = gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
      })
    }

    return () => {
      if (timeline.current) {
        timeline.current.kill()
      }
    }
  }, [displayStep, isTransitioning])

  return containerRef
}
