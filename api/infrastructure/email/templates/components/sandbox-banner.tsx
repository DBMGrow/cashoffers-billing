import { Section, Text } from '@react-email/components'
import { colors, font, spacing } from './tokens'

interface SandboxBannerProps {
  isSandbox?: boolean
}

/**
 * Renders a prominent warning banner when running in Square sandbox mode.
 * Only visible in non-production environments. Replaces the old {{environmentDisclaimer}} field.
 */
export function SandboxBanner({ isSandbox }: SandboxBannerProps) {
  if (!isSandbox) return null

  return (
    <Section
      style={{
        padding: `${spacing.sm} ${spacing.md} 0`,
      }}
    >
      <div
        style={{
          backgroundColor: colors.status.warningBg,
          border: `1px solid #fcd34d`,
          borderRadius: '6px',
          padding: `${spacing.sm} ${spacing.md}`,
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            margin: '0',
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            color: colors.status.warningText,
            letterSpacing: '0.3px',
          }}
        >
          TEST ENVIRONMENT
        </Text>
        <Text
          style={{
            margin: '4px 0 0 0',
            fontSize: font.size.sm,
            color: colors.status.warningText,
          }}
        >
          No real charges were made. This is a Square sandbox transaction.
        </Text>
      </div>
    </Section>
  )
}
