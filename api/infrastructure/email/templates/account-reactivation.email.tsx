import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { ActionButton } from './components/action-button'

export interface AccountReactivationEmailProps {
  name: string
  reactivationUrl: string
  whitelabel?: WhitelabelBrandingProps
}

export default function AccountReactivationEmail({ name, reactivationUrl, whitelabel }: AccountReactivationEmailProps) {
  const brandName = whitelabel?.name ?? 'CashOffers'
  return (
    <StandardEmail
      title={`Reactivate Your ${brandName} Account`}
      preview={`Hi ${name}, click to reactivate your ${brandName} account.`}
      whitelabel={whitelabel}
    >
      <EmailHeading>Reactivate Your Account</EmailHeading>
      <EmailDivider />
      <EmailText>Hi {name},</EmailText>
      <EmailText>
        We received a request to reactivate your {brandName} account. Click the button below to reactivate
        your account as a freemium user.
      </EmailText>

      <ActionButton href={reactivationUrl} variant="primary">
        Reactivate My Account
      </ActionButton>

      <EmailText variant="muted" style={{ marginTop: '20px' }}>
        This link will expire in 24 hours for security purposes.
      </EmailText>
      <EmailText variant="muted" style={{ marginBottom: '0' }}>
        If you did not request this, you can safely ignore this email.
      </EmailText>
    </StandardEmail>
  )
}

AccountReactivationEmail.PreviewProps = {
  name: 'Jane Smith',
  reactivationUrl: 'https://billing.example.com/reactivate?token=abc123',
} satisfies AccountReactivationEmailProps
