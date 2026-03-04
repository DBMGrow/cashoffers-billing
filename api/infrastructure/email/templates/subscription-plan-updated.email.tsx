import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface SubscriptionPlanUpdatedEmailProps {
  subscription: string
  amount: string
  date: string
  transactionID?: string
  isSandbox?: boolean
}

export default function SubscriptionPlanUpdatedEmail({
  subscription,
  amount,
  date,
  transactionID,
  isSandbox,
}: SubscriptionPlanUpdatedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Plan Updated"
      preview={`Your subscription plan has been changed to ${subscription}.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Subscription Plan Updated</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription plan has been changed successfully. Your new plan is now active.
      </EmailText>

      <SummaryTable>
        <SummaryRow label="Effective Date" value={date} bordered={false} />
        {transactionID && (
          <SummaryRow label="Transaction ID" value={transactionID} bordered={false} />
        )}
      </SummaryTable>

      <SummaryTable>
        <SummaryRow isHeader label="Plan Details" value="" />
        <SummaryRow label="New Plan" value={subscription} />
        <SummaryRow label="Next Renewal Date" value={date} />
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
  date: 'February 28, 2024',
  transactionID: 'txn_1234567890',
} satisfies SubscriptionPlanUpdatedEmailProps
