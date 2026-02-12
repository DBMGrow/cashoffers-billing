"use client"

import { useState, useEffect, useRef } from "react"
import { gsap } from "gsap"

export default function useAnimateText(
  text: string,
  duration: number = 0.5,
  delay: number = 0,
  replacements: Record<string, string> = {}
): string {
  const [displayText, setDisplayText] = useState("")
  const animationRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.kill()
    }

    // Apply replacements
    let parsedText = text
    for (const [key, value] of Object.entries(replacements)) {
      parsedText = parsedText.replace(`{${key}}`, value)
    }

    // Animate
    const obj = { length: 0 }
    animationRef.current = gsap.to(obj, {
      length: parsedText.length,
      duration,
      delay,
      ease: "power2.inOut",
      onUpdate: () => {
        const currentLength = Math.round(obj.length)
        setDisplayText(parsedText.slice(0, currentLength))
      },
    })

    return () => {
      if (animationRef.current) {
        animationRef.current.kill()
      }
    }
  }, [text, duration, delay, JSON.stringify(replacements)])

  return displayText
}
