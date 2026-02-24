"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { gsap } from "gsap"

export default function useAnimateText(
  text: string,
  duration: number = 0.5,
  delay: number = 0,
  replacements: Record<string, string> = {},
  isTransitioning: boolean = false
): string {
  const [displayText, setDisplayText] = useState("")
  const animationRef = useRef<gsap.core.Tween | null>(null)
  const previousText = useRef("")
  const isFirstRender = useRef(true)

  // Memoize parsed text to avoid unnecessary recalculations
  const parsedText = useMemo(() => {
    let result = text
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(`{${key}}`, value)
    }
    return result
  }, [text, ...Object.values(replacements)])

  useEffect(() => {
    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.kill()
    }

    // First render: just animate in
    if (isFirstRender.current) {
      const obj = { length: 0 }
      animationRef.current = gsap.to(obj, {
        length: parsedText.length,
        duration,
        delay,
        ease: "power2.out",
        onUpdate: () => {
          const currentLength = Math.round(obj.length)
          setDisplayText(parsedText.slice(0, currentLength))
        },
        onComplete: () => {
          // Update previousText after animation completes
          previousText.current = parsedText
        },
      })

      isFirstRender.current = false
      return
    }

    // If transitioning, animate out
    if (isTransitioning) {
      // Capture current display text length at the moment transition starts
      const startLength = displayText.length
      const obj = { length: startLength }

      animationRef.current = gsap.to(obj, {
        length: 0,
        duration: 0.2,
        ease: "power2.in",
        onUpdate: () => {
          const newLength = Math.round(obj.length)
          setDisplayText(previousText.current.slice(0, newLength))
        },
        onComplete: () => {
          // Clear previous text so the animate in will definitely trigger
          previousText.current = ""
        },
      })
    } else if (previousText.current !== parsedText) {
      // Not transitioning and text changed, animate in new text
      const obj = { length: 0 }
      animationRef.current = gsap.to(obj, {
        length: parsedText.length,
        duration,
        delay: 0.1,
        ease: "power2.out",
        onUpdate: () => {
          const currentLength = Math.round(obj.length)
          setDisplayText(parsedText.slice(0, currentLength))
        },
        onComplete: () => {
          // Update previousText after animation completes
          previousText.current = parsedText
        },
      })
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.kill()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedText, duration, delay, isTransitioning])

  return displayText
}
