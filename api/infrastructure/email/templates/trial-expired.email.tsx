import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { ActionButton } from "./components/action-button"

export interface TrialExpiredEmailProps {
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function TrialExpiredEmail({ isSandbox, whitelabel }: TrialExpiredEmailProps) {
  const brandName = whitelabel?.name ?? "CashOffers"
  const billingUrl = whitelabel?.billing_url ?? "https://account.cashoffers.pro"
  return (
    <StandardEmail
      title="Your Free Trial Has Expired"
      preview={`Your free trial has ended. Upgrade to continue using ${brandName}.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Your Free Trial Has Expired</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your free trial has ended and your access to {brandName} and HomeUptick has been suspended. To restore your
        access, please upgrade to a paid subscription.
      </EmailText>

      <EmailText>All your data has been preserved and will be available when you upgrade.</EmailText>

      <ActionButton href={billingUrl}>Upgrade Now</ActionButton>

      <EmailText variant="muted" style={{ marginTop: "16px", textAlign: "center", marginBottom: "0" }}>
        If you have any questions, please contact our support team.
      </EmailText>
    </StandardEmail>
  )
}

TrialExpiredEmail.PreviewProps = {} satisfies TrialExpiredEmailProps
