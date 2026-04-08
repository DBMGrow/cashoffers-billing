import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface SubscriptionCancelledEmailProps {
  subscription: string
  /** Date when access ends / cancellation takes effect */
  effectiveDate?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
  /** True when the subscription was already cancelled (e.g. executed at renewal), false when scheduled for future cancellation */
  immediate?: boolean
}

/**
 * User notification sent when a subscription is cancelled or scheduled for cancellation.
 * Use `immediate: true` when the cancellation has already taken effect (e.g. executed at renewal).
 */
export default function SubscriptionCancelledEmail({
  subscription,
  effectiveDate,
  isSandbox,
  whitelabel,
  immediate = false,
}: SubscriptionCancelledEmailProps) {
  if (immediate) {
    return (
      <StandardEmail
        title="Subscription Cancelled"
        preview={`Your ${subscription} subscription has been cancelled.`}
        isSandbox={isSandbox}
        whitelabel={whitelabel}
      >
        <EmailHeading>Subscription Cancelled</EmailHeading>
        <EmailDivider />
        <EmailText>
          Your subscription has been cancelled. You will no longer be charged, and your access has
          ended.
        </EmailText>

        <SummaryTable>
          <SummaryRow isHeader label="Cancellation Details" value="" />
          <SummaryRow label="Subscription" value={subscription} bordered={false} />
        </SummaryTable>

        <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
          If you have any questions, please contact our support team.
        </EmailText>
      </StandardEmail>
    )
  }

  return (
    <StandardEmail
      title="Subscription Cancellation Scheduled"
      preview={`Your ${subscription} subscription is scheduled to cancel at the end of your billing period.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Subscription Cancellation Scheduled</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription has been set to cancel. You will continue to have full access until the
        end of your current billing period — no further charges will be made after that date.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Cancellation Details" value="" />
        <SummaryRow label="Subscription" value={subscription} />
        {effectiveDate && (
          <SummaryRow label="Access Ends On" value={effectiveDate} bordered={false} />
        )}
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        If you change your mind, please contact our support team before the cancellation takes
        effect.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionCancelledEmail.PreviewProps = {
  subscription: 'Premium Monthly',
  effectiveDate: 'February 28, 2024',
} satisfies SubscriptionCancelledEmailProps
