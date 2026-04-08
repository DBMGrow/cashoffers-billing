import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface SubscriptionPlanUpdatedEmailProps {
  subscription: string
  amount: string
  effectiveDate: string
  nextRenewalDate?: string
  transactionID?: string
  proratedCharge?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function SubscriptionPlanUpdatedEmail({
  subscription,
  amount,
  effectiveDate,
  nextRenewalDate,
  transactionID,
  proratedCharge,
  isSandbox,
  whitelabel,
}: SubscriptionPlanUpdatedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Plan Updated"
      preview={`Your subscription plan has been changed to ${subscription}.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Subscription Plan Updated</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription plan has been changed successfully. Your new plan is now active.
      </EmailText>

      <SummaryTable>
        <SummaryRow label="Effective Date" value={effectiveDate} bordered={false} />
        {transactionID && (
          <SummaryRow label="Transaction ID" value={transactionID} bordered={false} />
        )}
        {proratedCharge && (
          <SummaryRow label="Prorated Charge" value={proratedCharge} bordered={false} />
        )}
      </SummaryTable>

      <SummaryTable>
        <SummaryRow isHeader label="Plan Details" value="" />
        <SummaryRow label="New Plan" value={subscription} />
        {nextRenewalDate && (
          <SummaryRow label="Next Renewal Date" value={nextRenewalDate} />
        )}
        <SummaryRow isTotal label="Renewal Amount" value={amount} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        Your next renewal will be charged at the amount shown above.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionPlanUpdatedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  amount: '$99.00',
  effectiveDate: 'February 28, 2024',
  nextRenewalDate: 'March 28, 2024',
  transactionID: 'txn_1234567890',
  proratedCharge: '$42.50',
} satisfies SubscriptionPlanUpdatedEmailProps
