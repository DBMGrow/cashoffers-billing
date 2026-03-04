import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface SubscriptionDowngradedEmailProps {
  subscription: string
  /** The plan the subscription will move to */
  targetPlan?: string
  /** Date when the downgrade takes effect */
  effectiveDate?: string
  isSandbox?: boolean
}

/**
 * User notification sent when their subscription is scheduled to downgrade on renewal.
 */
export default function SubscriptionDowngradedEmail({
  subscription,
  targetPlan,
  effectiveDate,
  isSandbox,
}: SubscriptionDowngradedEmailProps) {
  return (
    <StandardEmail
      title="Subscription Downgrade Scheduled"
      preview={`Your ${subscription} subscription is scheduled to change at the end of your billing period.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Subscription Downgrade Scheduled</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your subscription has been scheduled for a plan change at the end of your current billing
        period. You will continue on your current plan until then.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Plan Change Details" value="" />
        <SummaryRow label="Current Plan" value={subscription} />
        {targetPlan && <SummaryRow label="New Plan" value={targetPlan} />}
        {effectiveDate && (
          <SummaryRow label="Effective Date" value={effectiveDate} bordered={false} />
        )}
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        If you have questions about this change, please contact our support team.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionDowngradedEmail.PreviewProps = {
  subscription: 'Premium Annual',
  targetPlan: 'Premium Monthly',
  effectiveDate: 'February 28, 2024',
} satisfies SubscriptionDowngradedEmailProps
