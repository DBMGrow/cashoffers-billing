"use client"

import { FC, ReactNode } from "react"

interface UIProviderProps {
  children: ReactNode
}

const UIProvider: FC<UIProviderProps> = ({ children }) => {
  // Simple passthrough - NextUI removed
  return <>{children}</>
}

export default UIProvider
