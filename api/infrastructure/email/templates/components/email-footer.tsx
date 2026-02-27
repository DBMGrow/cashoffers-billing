import { Section, Text, Link } from '@react-email/components'
import { colors, font, spacing } from './tokens'

interface EmailFooterProps {
  year?: number
}

/**
 * Email footer with support link and copyright notice.
 */
export function EmailFooter({ year = new Date().getFullYear() }: EmailFooterProps) {
  return (
    <Section
      style={{
        padding: `${spacing.lg} ${spacing.md} ${spacing['4xl']}`,
      }}
    >
      <Text
        style={{
          margin: '0 0 4px 0',
          textAlign: 'center',
          fontSize: font.size.sm,
          color: colors.text.subtle,
          lineHeight: font.lineHeight.relaxed,
        }}
      >
        Questions? Contact us at{' '}
        <Link
          href="mailto:support@cashoffers.com"
          style={{ color: colors.text.muted, textDecoration: 'none' }}
        >
          support@cashoffers.com
        </Link>
      </Text>
      <Text
        style={{
          margin: '0',
          textAlign: 'center',
          fontSize: font.size.xs,
          color: colors.text.subtle,
          lineHeight: font.lineHeight.relaxed,
        }}
      >
        &copy; {year} CashOffers. All rights reserved.
      </Text>
    </Section>
  )
}
