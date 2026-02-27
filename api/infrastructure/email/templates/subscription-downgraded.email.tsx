import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'

export interface SubscriptionDowngradedEmailProps {
  /** Admin recipient name for context */
  name: string
  /** User email for context */
  email: string
}

/**
 * Admin notification sent when a user sets their subscription to downgrade on renewal.
 * This email goes to the admin, not the user.
 */
export default function SubscriptionDowngradedEmail({
  name,
  email,
}: SubscriptionDowngradedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Downgrade"
      preview={`${name} has set their subscription to downgrade on renewal.`}
    >
      <EmailHeading>Subscription Downgrade</EmailHeading>
      <EmailDivider />
      <EmailText>
        The user <strong>{name}</strong> ({email}) has set their subscription to downgrade on
        renewal.
      </EmailText>
      <EmailText variant="muted" style={{ marginBottom: '0' }}>
        The downgrade will take effect at the end of the current billing period.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionDowngradedEmail.PreviewProps = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
} satisfies SubscriptionDowngradedEmailProps
