"use client"

import { type ReactNode, type RefObject } from "react"
import { ThemeButton } from "@/components/Theme/ThemeButton"

interface FlowWrapperProps {
  titleText: string
  descriptionText: string
  containerRef: RefObject<HTMLDivElement | null>
  children: ReactNode
  allowReset: boolean
  onReset: () => void
  minHeight?: string
}

export default function FlowWrapper({
  titleText,
  descriptionText,
  containerRef,
  children,
  allowReset,
  onReset,
  minHeight = "250px",
}: FlowWrapperProps) {
  return (
    <>
      <div className="w-full border-default-300 py-8 px-2 flex flex-col justify-between" style={{ minHeight }}>
        <div className="rounded">
          <h2 className="h-6.25 text-lg">{titleText}</h2>
          <p className="h-3.75 my-1 text-sm">{descriptionText}</p>
        </div>
        <div className="flex w-full gap-2 py-4" ref={containerRef} style={{ opacity: 0 }}>
          {children}
        </div>
      </div>
      <div className="w-30">
        <ThemeButton color="blur" className="w-full" isDisabled={!allowReset} onPress={onReset}>
          Start&nbsp;Over
        </ThemeButton>
      </div>
    </>
  )
}
