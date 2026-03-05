import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'

export interface SubscriptionSuspendedEmailProps {
  subscription: string
  link: string
  date?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function SubscriptionSuspendedEmail({
  subscription,
  link,
  date,
  isSandbox,
  whitelabel,
}: SubscriptionSuspendedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Suspended"
      preview={`Your ${subscription} subscription has been suspended due to a payment issue.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Subscription Suspended</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription has been suspended due to a failed payment. To restore access, please
        update your billing information.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Subscription Details" value="" />
        <SummaryRow label="Subscription" value={subscription} />
        {date && <SummaryRow label="Suspended On" value={date} bordered={false} />}
      </SummaryTable>

      <ActionButton href={link} variant="danger">
        Update Billing Information
      </ActionButton>

      <EmailText variant="muted" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '0' }}>
        Once updated, your subscription will be reactivated automatically.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionSuspendedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  link: 'https://billing.cashoffers.com/payment',
  date: 'January 31, 2024',
} satisfies SubscriptionSuspendedEmailProps
