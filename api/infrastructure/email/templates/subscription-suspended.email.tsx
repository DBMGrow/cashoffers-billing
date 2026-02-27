import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { ActionButton } from './components/action-button'

export interface SubscriptionSuspendedEmailProps {
  subscription: string
  link: string
  isSandbox?: boolean
}

export default function SubscriptionSuspendedEmail({
  subscription,
  link,
  isSandbox,
}: SubscriptionSuspendedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Suspended"
      preview={`Your ${subscription} subscription has been suspended due to a payment issue.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Subscription Suspended</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription <strong>{subscription}</strong> has been suspended due to a payment
        issue.
      </EmailText>
      <EmailText style={{ marginBottom: '0' }}>
        To reactivate your account, please update your billing information.
      </EmailText>

      <ActionButton href={link} variant="danger">
        Update Billing Information
      </ActionButton>

      <EmailText variant="muted" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '0' }}>
        Once updated, your subscription will be reactivated.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionSuspendedEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  link: 'https://billing.cashoffers.com/payment',
} satisfies SubscriptionSuspendedEmailProps
