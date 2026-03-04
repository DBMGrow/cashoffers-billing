import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'

export interface SubscriptionPausedEmailProps {
  subscription: string
  date?: string
  isSandbox?: boolean
}

export default function SubscriptionPausedEmail({
  subscription,
  date,
  isSandbox,
}: SubscriptionPausedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Paused"
      preview={`Your ${subscription} subscription has been paused.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Subscription Paused</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription has been paused. You will not be charged during this period, and your
        access has been suspended until the subscription is reactivated.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Subscription Details" value="" />
        <SummaryRow label="Subscription" value={subscription} />
        {date && <SummaryRow label="Paused On" value={date} bordered={false} />}
      </SummaryTable>

      <EmailText style={{ marginTop: '20px', marginBottom: '0' }}>
        To have your subscription reactivated, please contact our support team.
      </EmailText>

      <ActionButton href="mailto:support@cashoffers.com" variant="warning">
        Contact Support
      </ActionButton>
    </StandardEmail>
  )
}

SubscriptionPausedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  date: 'January 31, 2024',
} satisfies SubscriptionPausedEmailProps
