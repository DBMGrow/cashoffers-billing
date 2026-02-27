import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { ActionButton } from './components/action-button'

export interface PaymentErrorEmailProps {
  amount: string
  errorMessage: string
  updatePaymentUrl: string
  date: string
  isSandbox?: boolean
}

export default function PaymentErrorEmail({
  amount,
  errorMessage,
  updatePaymentUrl,
  date,
  isSandbox,
}: PaymentErrorEmailProps) {
  return (
    <StandardEmail
      title="Payment Failed"
      preview={`We couldn't process your payment of ${amount}. Please update your billing information.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Payment Failed</EmailHeading>
      <EmailDivider />
      <EmailText>
        We couldn't process your payment of <strong>{amount}</strong>.
      </EmailText>
      <EmailText>{errorMessage}</EmailText>

      <EmailText variant="small" style={{ fontWeight: '600', marginBottom: '8px' }}>
        What you can do
      </EmailText>
      <EmailText style={{ marginBottom: '0' }}>
        Try a different payment method, contact your bank to authorize the transaction, or verify
        your card details are correct.
      </EmailText>

      <ActionButton href={updatePaymentUrl} variant="danger">
        Update Payment Method
      </ActionButton>

      <EmailText variant="muted" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '0' }}>
        Transaction date: {date}
      </EmailText>
    </StandardEmail>
  )
}

PaymentErrorEmail.PreviewProps = {
  amount: '$99.00',
  errorMessage: 'Your card was declined. Please check your card details and try again.',
  updatePaymentUrl: 'https://billing.cashoffers.com/payment',
  date: 'January 31, 2024',
} satisfies PaymentErrorEmailProps
