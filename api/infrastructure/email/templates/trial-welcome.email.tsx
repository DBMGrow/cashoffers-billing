import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'

export interface TrialWelcomeEmailProps {
  trialDays: number
  expirationDate: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function TrialWelcomeEmail({
  trialDays,
  expirationDate,
  isSandbox,
  whitelabel,
}: TrialWelcomeEmailProps) {
  const brandName = whitelabel?.name ?? 'CashOffers'
  const billingUrl = whitelabel?.billing_url ?? 'https://billing.cashoffers.com'
  return (
    <StandardEmail
      title="Welcome to Your Free Trial"
      preview={`Your ${trialDays}-day free trial has started. Explore ${brandName} and HomeUptick!`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Welcome to Your Free Trial!</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your <strong>{trialDays}-day free trial</strong> is now active. You have full access to the
        {brandName} portal and HomeUptick integration during your trial period.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Trial Details" value="" />
        <SummaryRow label="Trial Duration" value={`${trialDays} days`} />
        <SummaryRow label="Trial Expires" value={expirationDate} bordered={false} />
      </SummaryTable>

      <EmailText style={{ marginTop: '20px' }}>
        No payment is required during your trial. When your trial ends, you can upgrade to a paid
        plan to continue using all features.
      </EmailText>

      <ActionButton href={billingUrl}>
        Explore Your Dashboard
      </ActionButton>
    </StandardEmail>
  )
}

TrialWelcomeEmail.PreviewProps = {
  trialDays: 90,
  expirationDate: 'June 15, 2026',
} satisfies TrialWelcomeEmailProps
