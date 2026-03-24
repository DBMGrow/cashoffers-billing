import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'
import { InfoBox } from './components/info-box'

export interface SubscriptionRenewalFailedEmailProps {
  subscription: string
  date: string
  link: string
  /** Amount that was attempted, if known */
  amount?: string
  isSandbox?: boolean
}

export default function SubscriptionRenewalFailedEmail({
  subscription,
  date,
  link,
  amount,
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
        We were unable to renew your subscription. Please update your billing information to
        restore access and avoid suspension.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Renewal Details" value="" />
        <SummaryRow label="Subscription" value={subscription} />
        <SummaryRow label="Failed On" value={date} />
        {amount && <SummaryRow isTotal label="Amount Due" value={amount} bordered={false} />}
      </SummaryTable>

      <InfoBox variant="warning" title="Action required">
        Update your payment method below, then contact your bank to authorize the charge if needed.
        Your subscription will be suspended if this is not resolved.
      </InfoBox>

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
  link: 'https://billing.example.com/payment',
  amount: '$99.00',
} satisfies SubscriptionRenewalFailedEmailProps
