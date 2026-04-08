import { Section } from '@react-email/components'
import { colors, spacing, radius } from './tokens'

interface EmailCardProps {
  children: React.ReactNode
}

/**
 * White card container that holds the main email content.
 * Sits between the header and footer with clean borders and padding.
 */
export function EmailCard({ children }: EmailCardProps) {
  return (
    <Section
      style={{
        padding: `${spacing.lg} ${spacing.md} 0`,
      }}
    >
      <div
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          padding: `${spacing['2xl']} 28px`,
        }}
      >
        {children}
      </div>
    </Section>
  )
}
