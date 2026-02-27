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
  isSandbox?: boolean
}

export default function SubscriptionPlanUpdatedEmail({
  subscription,
  amount,
  date,
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
      <EmailText>Your subscription plan has been changed.</EmailText>

      <SummaryTable>
        <SummaryRow label="Subscription" value={subscription} />
        <SummaryRow label="Renewal Amount" value={amount} isTotal />
        <SummaryRow label="Next Renewal Date" value={date} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        Your new plan is now active.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionPlanUpdatedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  amount: '$99.00',
  date: 'February 28, 2024',
} satisfies SubscriptionPlanUpdatedEmailProps
