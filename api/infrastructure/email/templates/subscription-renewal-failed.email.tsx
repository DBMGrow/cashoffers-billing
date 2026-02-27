import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'

export interface SubscriptionRenewalFailedEmailProps {
  subscription: string
  date: string
  link: string
  isSandbox?: boolean
}

export default function SubscriptionRenewalFailedEmail({
  subscription,
  date,
  link,
  isSandbox,
}: SubscriptionRenewalFailedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Renewal Failed"
      preview="There was an issue renewing your subscription. Please update your billing information."
      isSandbox={isSandbox}
    >
      <EmailHeading>Subscription Renewal Failed</EmailHeading>
      <EmailDivider />
      <EmailText>
        There was an issue renewing your subscription. Please update your billing information to
        avoid service interruption.
      </EmailText>

      <SummaryTable>
        <SummaryRow label="Subscription" value={subscription} />
        <SummaryRow label="Date" value={date} bordered={false} />
      </SummaryTable>

      <EmailText style={{ marginTop: '20px' }}>
        Please confirm your billing information is correct and update it if needed.
      </EmailText>

      <ActionButton href={link} variant="danger">
        Update Billing Information
      </ActionButton>

      <EmailText variant="muted" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '0' }}>
        Your subscription will be paused until payment is resolved.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionRenewalFailedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  date: 'January 31, 2024',
  link: 'https://billing.cashoffers.com/payment',
} satisfies SubscriptionRenewalFailedEmailProps
