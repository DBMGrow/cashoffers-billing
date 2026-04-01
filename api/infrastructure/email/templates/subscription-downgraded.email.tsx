import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
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
  /** True when the downgrade has already happened (vs. scheduled for a future renewal) */
  immediate?: boolean
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

/**
 * User notification sent when their subscription is downgraded (or scheduled to downgrade on renewal).
 */
export default function SubscriptionDowngradedEmail({
  subscription,
  targetPlan,
  effectiveDate,
  immediate,
  isSandbox,
  whitelabel,
}: SubscriptionDowngradedEmailProps) {
  const title = immediate ? 'Your Subscription Has Been Downgraded' : 'Subscription Downgrade Scheduled'
  const bodyText = immediate
    ? 'Your subscription has been downgraded. Your account has been moved to the free plan.'
    : 'Your subscription has been scheduled for a plan change at the end of your current billing period. You will continue on your current plan until then.'

  return (
    <StandardEmail
      title={title}
      preview={immediate ? `Your ${subscription} subscription has been downgraded to the free plan.` : `Your ${subscription} subscription is scheduled to change at the end of your billing period.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>{title}</EmailHeading>
      <EmailDivider />
      <EmailText>{bodyText}</EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Plan Change Details" value="" />
        <SummaryRow label={immediate ? 'Previous Plan' : 'Current Plan'} value={subscription} />
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
