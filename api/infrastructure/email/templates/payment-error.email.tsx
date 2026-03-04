import { StandardEmail } from './components/standard-email'
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
        We were unable to process your payment of <strong>{amount}</strong>. Please update your
        payment method to avoid any service interruption.
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

      <InfoBox variant="warning" title="Steps to resolve">
        Update your payment method below, or contact your bank to authorize the charge and verify
        your card details are correct.
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
  updatePaymentUrl: 'https://billing.cashoffers.com/payment',
  date: 'January 31, 2024',
} satisfies PaymentErrorEmailProps
