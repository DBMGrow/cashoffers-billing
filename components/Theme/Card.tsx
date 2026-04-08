"use client"

import React, { KeyboardEvent, MouseEvent } from "react"

interface CardProps {
  isPressable?: boolean
  isDisabled?: boolean
  onPress?: () => void
  children: React.ReactNode
  className?: string
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

export function Card({ isPressable = false, isDisabled = false, onPress, children, className = "" }: CardProps) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isPressable && onPress && !isDisabled) {
      onPress()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isPressable && onPress && !isDisabled && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onPress()
    }
  }

  const baseClasses = "bg-white border border-gray-200 rounded-lg shadow transition-all duration-200"
  const disabledClasses = isDisabled ? "opacity-50 pointer-events-none" : ""
  const pressableClasses = isPressable && !isDisabled
    ? "cursor-pointer hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
    : ""

  const combinedClasses = `${baseClasses} ${pressableClasses} ${disabledClasses} ${className}`.trim()

  return (
    <div
      className={combinedClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isPressable ? "button" : undefined}
      tabIndex={isPressable ? 0 : undefined}
      aria-pressed={isPressable ? false : undefined}
    >
      {children}
    </div>
  )
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  const baseClasses = "p-4"
  const combinedClasses = `${baseClasses} ${className}`.trim()

  return <div className={combinedClasses}>{children}</div>
}
