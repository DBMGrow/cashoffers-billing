import { Section, Text } from '@react-email/components'
import { colors, font, spacing, radius } from './tokens'

type InfoBoxVariant = 'warning' | 'info'

interface InfoBoxProps {
  variant?: InfoBoxVariant
  title?: string
  children: React.ReactNode
}

const variantStyles: Record<InfoBoxVariant, { bg: string; borderColor: string; textColor: string }> = {
  warning: {
    bg: colors.status.warningBg,
    borderColor: '#fcd34d',
    textColor: colors.status.warningText,
  },
  info: {
    bg: '#eff6ff',
    borderColor: '#bfdbfe',
    textColor: '#1e40af',
  },
}

/**
 * Highlighted alert box for important notices (e.g. "Action Required" sections).
 * Used in the daily health report and any email requiring special attention.
 */
export function InfoBox({ variant = 'warning', title, children }: InfoBoxProps) {
  const styles = variantStyles[variant]

  return (
    <Section style={{ marginTop: spacing.lg }}>
      <div
        style={{
          backgroundColor: styles.bg,
          border: `1px solid ${styles.borderColor}`,
          borderRadius: radius.lg,
          padding: `${spacing.md} ${spacing.lg}`,
        }}
      >
        {title && (
          <Text
            style={{
              margin: '0 0 8px 0',
              fontSize: font.size.base,
              fontWeight: font.weight.semibold,
              color: styles.textColor,
            }}
          >
            {title}
          </Text>
        )}
        <Text
          style={{
            margin: '0',
            fontSize: font.size.sm,
            color: styles.textColor,
            lineHeight: font.lineHeight.relaxed,
          }}
        >
          {children}
        </Text>
      </div>
    </Section>
  )
}
