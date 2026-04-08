import { Button, Section } from "@react-email/components"
import { font, radius } from "./tokens"

type ButtonVariant = "danger" | "warning" | "primary"

interface ActionButtonProps {
  href: string
  children: React.ReactNode
  variant?: ButtonVariant
}

const variantColors: Record<ButtonVariant, { bg: string; border: string; hover?: string }> = {
  danger: {
    bg: "#f87171",
    border: "#dc2626",
    hover: "#ef4444", // slightly brighter red for hover
  },
  warning: {
    bg: "#fbbf24",
    border: "#d97706",
    hover: "#fde68a", // lighter amber for hover
  },
  primary: {
    bg: "#60a5fa",
    border: "#1e40af",
    hover: "#3b82f6", // slightly brighter blue for hover
  },
}

/**
 * Full-width CTA button for transactional emails.
 *
 * - `danger` (red) — update billing, failed payment recovery
 * - `warning` (amber) — contact support, paused/suspended
 * - `primary` (blue) — general call-to-action
 */
export function ActionButton({ href, children, variant = "primary" }: ActionButtonProps) {
  const { bg, border } = variantColors[variant]

  return (
    <Section style={{ textAlign: "center", marginTop: "24px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: bg,
          borderColor: border,
          borderWidth: "1px",
          borderStyle: "solid",
          color: "#ffffff",
          fontSize: font.size.base,
          fontWeight: font.weight.semibold,
          borderRadius: radius.md,
          padding: "13px 28px",
          textDecoration: "none",
          display: "inline-block",
          lineHeight: "1",
        }}
      >
        {children}
      </Button>
    </Section>
  )
}
