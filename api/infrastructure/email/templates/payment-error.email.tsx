import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { ActionButton } from './components/action-button'
import { InfoBox } from './components/info-box'

export interface PaymentErrorEmailProps {
  amount: string
  errorMessage: string
  declineReason?: string
  transactionId?: string
  subscription?: string
  cardLast4?: string
  updatePaymentUrl: string
  date: string
  isSandbox?: boolean
  /** Whether the system will automatically retry */
  willRetry?: boolean
  /** When the next retry will happen */
  nextRetryDate?: string
  /** Urgency level: 'first' | 'second' | 'third' | 'final' */
  urgency?: 'first' | 'second' | 'third' | 'final'
  whitelabel?: WhitelabelBrandingProps
}

function getUrgencyMessage(urgency?: string, nextRetryDate?: string, willRetry?: boolean): string {
  if (!willRetry) {
    return 'Your subscription has been suspended due to repeated payment failures. Update your payment method to restore access.'
  }
  switch (urgency) {
    case 'first':
      return `We'll automatically retry your payment${nextRetryDate ? ` on ${nextRetryDate}` : ' soon'}. To avoid interruption, please update your payment method.`
    case 'second':
      return `This is the second time we've been unable to process your payment. We'll retry again${nextRetryDate ? ` on ${nextRetryDate}` : ''}. Please update your payment method to avoid suspension.`
    case 'third':
      return `This is your third failed payment. We'll make one final attempt${nextRetryDate ? ` on ${nextRetryDate}` : ''}. If that payment fails, your subscription will be suspended. Please update your payment method now.`
    case 'final':
      return `This is our last retry attempt${nextRetryDate ? `, scheduled for ${nextRetryDate}` : ''}. If this payment fails, your subscription will be automatically suspended.`
    default:
      return 'Please update your payment method to avoid any service interruption.'
  }
}

export default function PaymentErrorEmail({
  amount,
  errorMessage,
  declineReason,
  transactionId,
  subscription,
  cardLast4,
  updatePaymentUrl,
  date,
  isSandbox,
  willRetry,
  nextRetryDate,
  urgency,
  whitelabel,
}: PaymentErrorEmailProps) {
  const urgencyVariant = !willRetry ? 'danger' as const : 'warning' as const
  const heading = !willRetry ? 'Subscription Suspended' : urgency === 'third' ? 'Suspension Warning' : 'Payment Failed'

  return (
    <StandardEmail
      title={heading}
      preview={`We couldn't process your payment of ${amount}. Please update your billing information.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>{heading}</EmailHeading>
      <EmailDivider />
      <EmailText>
        We were unable to process your payment of <strong>{amount}</strong>.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Transaction Details" value="" />
        <SummaryRow label="Transaction Date" value={date} />
        {transactionId && <SummaryRow label="Transaction ID" value={transactionId} />}
        {subscription && <SummaryRow label="Subscription" value={subscription} />}
        {cardLast4 && <SummaryRow label="Card" value={`•••• •••• •••• ${cardLast4}`} />}
        <SummaryRow label="Amount" value={amount} />
        <SummaryRow
          label="Decline Reason"
          value={declineReason ?? errorMessage}
          bordered={false}
        />
      </SummaryTable>

      <InfoBox variant={urgencyVariant} title={urgency === 'third' || !willRetry ? 'Urgent: Action required' : 'Action required'}>
        {getUrgencyMessage(urgency, nextRetryDate, willRetry)}
      </InfoBox>

      <ActionButton href={updatePaymentUrl} variant="danger">
        Update Payment Method
      </ActionButton>

      <EmailText variant="muted" style={{ textAlign: 'center', marginTop: '16px', marginBottom: '0' }}>
        If you need assistance, please contact our support team.
      </EmailText>
    </StandardEmail>
  )
}

PaymentErrorEmail.PreviewProps = {
  amount: '$99.00',
  errorMessage: 'Your card was declined. Please check your card details and try again.',
  declineReason: 'Card Declined',
  transactionId: 'txn_1234567890',
  subscription: 'Premium Monthly',
  cardLast4: '4242',
  updatePaymentUrl: 'https://billing.example.com/payment',
  date: 'January 31, 2024',
} satisfies PaymentErrorEmailProps
