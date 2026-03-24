import { Section, Text } from "@react-email/components"
import { colors, font, spacing } from "./tokens"

interface EmailHeaderProps {
  /** Whitelabel display name — rendered as a text wordmark */
  name?: string
}

/**
 * Text-based wordmark header.
 * Appears above the main card in every transactional email.
 * Displays the whitelabel name (defaults to "CashOffers").
 */
export function EmailHeader({ name }: EmailHeaderProps = {}) {
  return (
    <Section
      style={{
        padding: `${spacing["3xl"]} ${spacing.md} 0`,
      }}
    >
      <Text
        style={{
          margin: "0",
          fontSize: font.size.lg,
          fontWeight: font.weight.bold,
          color: colors.brand,
          letterSpacing: "-0.3px",
        }}
      >
        {name ?? "CashOffers"}
      </Text>
    </Section>
  )
}
