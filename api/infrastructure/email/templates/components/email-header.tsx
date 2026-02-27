import { Section, Text } from '@react-email/components'
import { colors, font, spacing } from './tokens'

/**
 * CashOffers wordmark header.
 * Appears above the main card in every transactional email.
 */
export function EmailHeader() {
  return (
    <Section
      style={{
        padding: `${spacing['3xl']} ${spacing.md} 0`,
      }}
    >
      <Text
        style={{
          margin: '0',
          fontSize: font.size.lg,
          fontWeight: font.weight.bold,
          color: colors.brand,
          letterSpacing: '-0.3px',
        }}
      >
        CashOffers
      </Text>
    </Section>
  )
}
