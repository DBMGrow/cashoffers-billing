import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'

export interface SubscriptionCancelledEmailProps {
  /** Admin recipient name for context */
  name: string
  /** User email for context */
  email: string
}

/**
 * Admin notification sent when a user sets their subscription to cancel on renewal.
 * This email goes to the admin, not the user.
 */
export default function SubscriptionCancelledEmail({
  name,
  email,
}: SubscriptionCancelledEmailProps) {
  return (
    <StandardEmail
      title="Subscription Cancellation"
      preview={`${name} has set their subscription to cancel on renewal.`}
    >
      <EmailHeading>Subscription Cancellation</EmailHeading>
      <EmailDivider />
      <EmailText>
        The user <strong>{name}</strong> ({email}) has set their subscription to cancel on renewal.
      </EmailText>
      <EmailText variant="muted" style={{ marginBottom: '0' }}>
        The subscription will remain active until the end of the current billing period.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionCancelledEmail.PreviewProps = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
} satisfies SubscriptionCancelledEmailProps
