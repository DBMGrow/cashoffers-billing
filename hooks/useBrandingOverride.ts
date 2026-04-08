"use client"

import { useEffect, useRef } from "react"
import type { User } from "@/types/api"

interface WhitelabelBranding {
  whitelabel_id: number
  code: string
  primary_color: string
  secondary_color: string
  logo_url: string
  marketing_website: string
}

/**
 * Dynamically overrides the FormsLayout branding (colors + logo)
 * to match the authenticated user's whitelabel.
 *
 * Call this from the manage flow after the user is identified.
 */
export function useBrandingOverride(user: User | null) {
  const appliedWhitelabelId = useRef<number | null>(null)

  useEffect(() => {
    if (!user?.whitelabel_id) return
    if (appliedWhitelabelId.current === user.whitelabel_id) return

    async function applyBranding() {
      try {
        const res = await fetch("/api/signup/whitelabels")
        const json = await res.json()
        if (json.success !== "success" || !json.data) return

        const wl = json.data.find(
          (w: WhitelabelBranding) => w.whitelabel_id === user!.whitelabel_id
        )
        if (!wl) return

        // Update CSS custom properties on the theme container
        const themeEl = document.querySelector(".theme-default") as HTMLElement
        if (themeEl) {
          if (wl.primary_color) themeEl.style.setProperty("--color-primary", wl.primary_color)
          if (wl.secondary_color) themeEl.style.setProperty("--color-secondary", wl.secondary_color)
        }

        // Update the logo image and link
        const logoLink = themeEl?.querySelector("a[target='_blank']") as HTMLAnchorElement
        if (logoLink) {
          if (wl.marketing_website) logoLink.href = wl.marketing_website

          const img = logoLink.querySelector("img") as HTMLImageElement
          if (img && wl.logo_url) {
            img.src = wl.logo_url
          }
        }

        appliedWhitelabelId.current = user!.whitelabel_id
      } catch (err) {
        console.error("Failed to apply whitelabel branding:", err)
      }
    }

    applyBranding()
  }, [user?.whitelabel_id])
}
