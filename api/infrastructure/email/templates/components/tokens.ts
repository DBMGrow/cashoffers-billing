/**
 * Design tokens for CashOffers transactional emails.
 * Single source of truth for colors, typography, and spacing.
 */

export const colors = {
  brand: "#333",
  brandLight: "#333",

  text: {
    heading: "#111827",
    body: "#374151",
    muted: "#6b7280",
    subtle: "#9ca3af",
    link: "#1e40af",
  },

  bg: {
    page: "#fafafa",
    card: "#ffffff",
    subtle: "#f9fafb",
    hover: "#f3f4f6",
  },

  border: "#efefef",
  borderSubtle: "#fefefe",

  status: {
    error: "#dc2626",
    errorBg: "#fef2f2",
    warning: "#d97706",
    warningBg: "#fef3c7",
    warningText: "#92400e",
    success: "#16a34a",
    successBg: "#f0fdf4",
  },
} as const

export const font = {
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  size: {
    xs: "11px",
    sm: "13px",
    base: "15px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
  },
  weight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.3",
    normal: "1.5",
    relaxed: "1.7",
  },
} as const

export const spacing = {
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
  "4xl": "48px",
} as const

export const radius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
} as const
