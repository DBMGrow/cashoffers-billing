import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { ActionButton } from "./components/action-button"
import { InfoBox } from "./components/info-box"

export interface TrialExpiringEmailProps {
  daysRemaining: number
  expirationDate: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function TrialExpiringEmail({
  daysRemaining,
  expirationDate,
  isSandbox,
  whitelabel,
}: TrialExpiringEmailProps) {
  const brandName = whitelabel?.name ?? "CashOffers"
  const billingUrl = whitelabel?.billing_url ?? "https://account.cashoffers.pro"
  return (
    <StandardEmail
      title="Your Free Trial Is Ending Soon"
      preview={`Your free trial expires in ${daysRemaining} days. Upgrade now to keep your access.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Your Trial Is Ending Soon</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your free trial expires in <strong>{daysRemaining} days</strong>. After your trial ends, your access to{" "}
        {brandName} and HomeUptick will be suspended.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Trial Status" value="" />
        <SummaryRow label="Days Remaining" value={String(daysRemaining)} />
        <SummaryRow label="Expires On" value={expirationDate} bordered={false} />
      </SummaryTable>

      <InfoBox variant="warning" title="Don't lose access">
        Upgrade to a paid plan before your trial ends to keep all your data and continue using {brandName} and
        HomeUptick without interruption.
      </InfoBox>

      <ActionButton href={billingUrl}>Upgrade Now</ActionButton>
    </StandardEmail>
  )
}

TrialExpiringEmail.PreviewProps = {
  daysRemaining: 10,
  expirationDate: "June 15, 2026",
} satisfies TrialExpiringEmailProps
