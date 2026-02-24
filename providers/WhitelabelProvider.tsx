"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

/**
 * Whitelabel branding data (stored in Whitelabels.data JSON field)
 */
export interface WhitelabelBrandingData {
  primary_color?: string
  secondary_color?: string
  logo_url?: string
}

/**
 * Whitelabel type matching the database schema
 */
export interface Whitelabel {
  whitelabel_id: number
  code: string
  name: string
  suspension_behavior: "DEACTIVATE_USER" | "DOWNGRADE_TO_FREE"
  data?: WhitelabelBrandingData | null
}

interface WhitelabelContextType {
  whitelabels: Whitelabel[]
  currentWhitelabel: Whitelabel | null
  loading: boolean
  error: string | null
  setWhitelabelByCode: (code: string) => void
  refetch: () => void
}

const WhitelabelContext = createContext<WhitelabelContextType | undefined>(
  undefined
)

interface WhitelabelProviderProps {
  children: ReactNode
  initialWhitelabel?: string
}

export function WhitelabelProvider({
  children,
  initialWhitelabel = "default",
}: WhitelabelProviderProps) {
  const [whitelabels, setWhitelabels] = useState<Whitelabel[]>([])
  const [currentWhitelabel, setCurrentWhitelabel] =
    useState<Whitelabel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWhitelabels = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/signup/whitelabels")

      if (!response.ok) {
        throw new Error(`Failed to fetch whitelabels: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success === "success" && data.data) {
        setWhitelabels(data.data)

        // Set initial whitelabel
        const initial = data.data.find(
          (wl: Whitelabel) => wl.code === initialWhitelabel
        )
        setCurrentWhitelabel(initial || data.data[0] || null)
      } else {
        throw new Error(data.error || "Failed to load whitelabels")
      }
    } catch (err) {
      console.error("Error fetching whitelabels:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWhitelabels()
  }, [initialWhitelabel])

  const setWhitelabelByCode = (code: string) => {
    const whitelabel = whitelabels.find((wl) => wl.code === code)
    if (whitelabel) {
      setCurrentWhitelabel(whitelabel)
    }
  }

  return (
    <WhitelabelContext.Provider
      value={{
        whitelabels,
        currentWhitelabel,
        loading,
        error,
        setWhitelabelByCode,
        refetch: fetchWhitelabels,
      }}
    >
      {children}
    </WhitelabelContext.Provider>
  )
}

export const useWhitelabel = () => {
  const context = useContext(WhitelabelContext)
  if (context === undefined) {
    throw new Error("useWhitelabel must be used within a WhitelabelProvider")
  }
  return context
}
