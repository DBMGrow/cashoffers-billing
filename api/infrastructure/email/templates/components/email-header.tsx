import { Section, Text, Img } from "@react-email/components"
import { colors, font, spacing } from "./tokens"

interface EmailHeaderProps {
  logo?: string
}

/**
 * CashOffers wordmark header.
 * Appears above the main card in every transactional email.
 * Displays whitelabel logo if provided.
 */
export function EmailHeader({ logo }: EmailHeaderProps = {}) {
  if (logo) {
    return (
      <Section
        style={{
          padding: `${spacing["3xl"]} ${spacing.md} 0`,
        }}
      >
        <Img
          src={logo}
          alt="Logo"
          width="120"
          height="48"
          style={{
            margin: "0 auto",
            display: "block",
            maxWidth: "100%",
            height: "auto",
          }}
        />
      </Section>
    )
  }

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
        CashOffers.PRO
      </Text>
    </Section>
  )
}
