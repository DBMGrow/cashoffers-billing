"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"

export default function useAnimateContainer(trigger: unknown) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useLayoutEffect(() => {
    if (!containerRef.current) return

    // Reset to initial state before animating
    gsap.set(containerRef.current, {
      opacity: 0,
      y: -5,
    })

    // Fade in
    const timeline = gsap.to(containerRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      delay: isFirstRender.current ? 0.5 : 0.2,
      ease: "power2.inOut",
    })

    if (isFirstRender.current) {
      isFirstRender.current = false
    }

    return () => {
      timeline.kill()
    }
  }, [trigger])

  return containerRef
}
