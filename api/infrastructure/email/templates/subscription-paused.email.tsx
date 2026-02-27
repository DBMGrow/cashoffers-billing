import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { ActionButton } from './components/action-button'

export interface SubscriptionPausedEmailProps {
  subscription: string
  isSandbox?: boolean
}

export default function SubscriptionPausedEmail({
  subscription,
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
        Your subscription <strong>{subscription}</strong> has been paused.
      </EmailText>
      <EmailText style={{ marginBottom: '0' }}>
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
} satisfies SubscriptionPausedEmailProps
