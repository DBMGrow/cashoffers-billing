import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { InfoBox } from "./components/info-box"

export interface PurchaseErrorCustomerEmailProps {
  /** Customer-friendly description of what happened */
  reason: string
  /** Amount the customer was charged (formatted, e.g. "$99.00") */
  amountCharged?: string
  /** Date the purchase was attempted */
  date: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

/**
 * Customer-facing email sent when a purchase error occurs after payment
 * (e.g. user provisioning failed). Reassures the customer that their
 * payment was received and that the team is resolving the issue.
 */
export default function PurchaseErrorCustomerEmail({
  reason,
  amountCharged,
  date,
  isSandbox,
  whitelabel,
}: PurchaseErrorCustomerEmailProps) {
  const supportEmail = whitelabel?.support_email ?? 'support@cashoffers.com'
  return (
    <StandardEmail
      title="Issue With Your Purchase"
      preview="We received your payment but ran into an issue setting up your account."
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Issue With Your Purchase</EmailHeading>
      <EmailDivider />
      <EmailText>
        We received your payment but ran into an issue completing your account setup. Our team has
        been automatically notified and is working to resolve this.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Details" value="" />
        <SummaryRow label="Date" value={date} />
        {amountCharged && <SummaryRow label="Amount Charged" value={amountCharged} />}
        <SummaryRow label="Issue" value={reason} bordered={false} />
      </SummaryTable>

      <InfoBox variant="info" title="What happens next?">
        You do not need to take any action. Our team will finish setting up your account and reach
        out to you within 24 hours. If you have questions in the meantime, please contact us at{' '}
        {supportEmail}.
      </InfoBox>

      <EmailText variant="muted" style={{ marginTop: "20px", marginBottom: "0" }}>
        Your payment is secure and you will not be charged again. If the issue cannot be resolved,
        you will receive a full refund.
      </EmailText>
    </StandardEmail>
  )
}

PurchaseErrorCustomerEmail.PreviewProps = {
  reason: "We were unable to finish setting up your account.",
  amountCharged: "$99.00",
  date: "January 31, 2024",
} satisfies PurchaseErrorCustomerEmailProps
