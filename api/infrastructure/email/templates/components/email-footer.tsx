import { Section, Text, Link } from "@react-email/components"
import { colors, font, spacing } from "./tokens"

export interface WhitelabelBrandingProps {
  /** Display name for the whitelabel (e.g. "kw Offerings") */
  name?: string
  logo_url?: string
  primary_color?: string
  secondary_color?: string
  marketing_website?: string
  /** Support email address (e.g. "support@kwofferings.com") */
  support_email?: string
  /** Billing portal base URL (e.g. "https://billing.kwofferings.com") */
  billing_url?: string
}

interface EmailFooterProps {
  year?: number
  whitelabel?: WhitelabelBrandingProps
  /** Name REMrktCo as the merchant behind the charge. Set only by templates that report a charge. */
  showChargeNotice?: boolean
}

/** Payers on a white label do not recognize REMrktCo on their statement, so charge emails say who charged them. */
export const CHARGE_NOTICE = "This charge is from REMrktCo and will appear as REMRKTCO on your statement."

/**
 * Email footer with support link, copyright notice, optional whitelabel marketing website,
 * and an optional notice naming REMrktCo as the merchant behind a charge.
 */
export function EmailFooter({ year = new Date().getFullYear(), whitelabel, showChargeNotice }: EmailFooterProps) {
  const brandName = whitelabel?.name ?? "CashOffers"
  const supportEmail = whitelabel?.support_email ?? "support@cashoffers.pro"
  const isWhitelabeled = whitelabel && whitelabel.marketing_website && whitelabel.marketing_website !== "/"

  return (
    <Section
      style={{
        padding: `${spacing.lg} ${spacing.md} ${spacing["4xl"]}`,
      }}
    >
      {isWhitelabeled && whitelabel?.marketing_website && (
        <Text
          style={{
            margin: "0 0 12px 0",
            textAlign: "center",
            fontSize: font.size.sm,
            color: colors.text.muted,
            lineHeight: font.lineHeight.relaxed,
          }}
        >
          <Link
            href={whitelabel.marketing_website}
            style={{ color: colors.brand, textDecoration: "none", fontWeight: font.weight.semibold }}
          >
            Visit our website
          </Link>
        </Text>
      )}
      {showChargeNotice && (
        <Text
          style={{
            margin: "0 0 12px 0",
            textAlign: "center",
            fontSize: font.size.sm,
            color: colors.text.muted,
            lineHeight: font.lineHeight.relaxed,
          }}
        >
          {CHARGE_NOTICE}
        </Text>
      )}
      <Text
        style={{
          margin: "0 0 4px 0",
          textAlign: "center",
          fontSize: font.size.sm,
          color: colors.text.subtle,
          lineHeight: font.lineHeight.relaxed,
        }}
      >
        Questions? Contact us at{" "}
        <Link href={`mailto:${supportEmail}`} style={{ color: colors.text.muted, textDecoration: "none" }}>
          {supportEmail}
        </Link>
      </Text>
      <Text
        style={{
          margin: "0",
          textAlign: "center",
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
