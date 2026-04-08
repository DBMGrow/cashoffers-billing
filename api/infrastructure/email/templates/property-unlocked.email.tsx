import { Img, Section } from "@react-email/components"
import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { colors, font, radius, spacing } from "./components/tokens"

export interface PropertyUnlockedEmailProps {
  propertyAddress: string
  propertyImageUrl?: string
  amount: string
  transactionID: string
  date: string
  productName?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function PropertyUnlockedEmail({
  propertyAddress,
  propertyImageUrl,
  amount,
  transactionID,
  date,
  productName,
  isSandbox,
  whitelabel,
}: PropertyUnlockedEmailProps) {
  const brandName = whitelabel?.name ?? "CashOffers"

  return (
    <StandardEmail
      title="Property Unlocked"
      preview={`You've unlocked ${propertyAddress} — full property details are now available.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Property Unlocked</EmailHeading>
      <EmailDivider />

      <EmailText>
        You've successfully unlocked a property. Full details are now available in your <strong>{brandName}</strong>{" "}
        account.
      </EmailText>

      {/* Property card with image + address */}
      <Section style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <div
          style={{
            borderRadius: radius.lg,
            // border: `1px solid ${colors.border}`,
            overflow: "hidden",
          }}
        >
          {propertyImageUrl && (
            <Img
              src={propertyImageUrl}
              alt={propertyAddress}
              width="100%"
              style={{
                display: "block",
                maxHeight: "220px",
                objectFit: "cover",
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
              }}
            />
          )}
          <div
            style={{
              padding: `${spacing.md} ${spacing.lg}`,
              backgroundColor: colors.bg.subtle,
            }}
          >
            <div
              style={{
                fontSize: font.size.xs,
                fontWeight: font.weight.semibold,
                textTransform: "uppercase" as const,
                letterSpacing: "0.8px",
                color: colors.text.subtle,
                marginBottom: "4px",
              }}
            >
              Property
            </div>
            <div
              style={{
                fontSize: font.size.base,
                fontWeight: font.weight.semibold,
                color: colors.text.heading,
                lineHeight: font.lineHeight.tight,
              }}
            >
              {propertyAddress}
            </div>
          </div>
        </div>
      </Section>

      {/* Transaction details */}
      <SummaryTable>
        <SummaryRow isHeader label="Transaction Details" value="" />
        <SummaryRow label="Date" value={date} />
        <SummaryRow label="Transaction ID" value={transactionID} />
        <SummaryRow label="Description" value={productName ?? "Property Unlock"} />
        <SummaryRow isTotal label="Amount Charged" value={amount} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: spacing.lg, marginBottom: "0" }}>
        This is a one-time charge. No recurring payments will be made for this property.
      </EmailText>
    </StandardEmail>
  )
}

PropertyUnlockedEmail.PreviewProps = {
  propertyAddress: "1234 Oak Ridge Dr, Springfield, IL",
  propertyImageUrl: "https://placehold.co/600x220/f9fafb/374151?text=Property+Photo",
  amount: "$50.00",
  transactionID: "TXN-987654321",
  date: "April 7, 2026",
  productName: "Property Unlock",
} satisfies PropertyUnlockedEmailProps
