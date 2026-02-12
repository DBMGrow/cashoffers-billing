"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"

export default function useAnimateContainer(trigger: any) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const timeline = gsap.timeline()

    // Fade out
    timeline.to(containerRef.current, {
      opacity: 0,
      y: 5,
      duration: 0.4,
      ease: "power2.inOut",
    })

    // Fade in
    timeline.fromTo(
      containerRef.current,
      { y: -5 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: "power2.inOut",
      }
    )

    return () => {
      timeline.kill()
    }
  }, [trigger])

  return containerRef
}
