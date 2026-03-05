import { Section, Text, Link } from '@react-email/components'
import { colors, font, spacing } from './tokens'

export interface WhitelabelBrandingProps {
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  marketing_website?: string
}

interface EmailFooterProps {
  year?: number
  whitelabel?: WhitelabelBrandingProps
}

/**
 * Email footer with support link, copyright notice, and optional whitelabel marketing website.
 */
export function EmailFooter({ year = new Date().getFullYear(), whitelabel }: EmailFooterProps) {
  const isWhitelabeled = whitelabel && whitelabel.marketing_website && whitelabel.marketing_website !== "/"
  const brandName = isWhitelabeled ? "CashOffers" : "CashOffers"

  return (
    <Section
      style={{
        padding: `${spacing.lg} ${spacing.md} ${spacing['4xl']}`,
      }}
    >
      {isWhitelabeled && whitelabel?.marketing_website && (
        <Text
          style={{
            margin: '0 0 12px 0',
            textAlign: 'center',
            fontSize: font.size.sm,
            color: colors.text.muted,
            lineHeight: font.lineHeight.relaxed,
          }}
        >
          <Link
            href={whitelabel.marketing_website}
            style={{ color: colors.brand, textDecoration: 'none', fontWeight: font.weight.semibold }}
          >
            Visit our website
          </Link>
        </Text>
      )}
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
        &copy; {year} {brandName}. All rights reserved.
      </Text>
    </Section>
  )
}
