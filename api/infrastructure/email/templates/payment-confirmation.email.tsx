import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface PaymentConfirmationEmailProps {
  amount: string
  transactionID: string
  date: string
  isSandbox?: boolean
}

export default function PaymentConfirmationEmail({
  amount,
  transactionID,
  date,
  isSandbox,
}: PaymentConfirmationEmailProps) {
  return (
    <StandardEmail
      title="Payment Successful"
      preview={`Your payment of ${amount} was processed successfully.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Payment Successful</EmailHeading>
      <EmailDivider />
      <EmailText>Your payment has been processed successfully.</EmailText>

      <SummaryTable>
        <SummaryRow label="Amount Charged" value={amount} isTotal />
        <SummaryRow label="Transaction ID" value={transactionID} />
        <SummaryRow label="Date" value={date} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        A charge of {amount} has been applied to your payment method. Thank you for your payment.
      </EmailText>
    </StandardEmail>
  )
}

PaymentConfirmationEmail.PreviewProps = {
  amount: '$99.00',
  transactionID: 'TXN-123456789',
  date: 'January 31, 2024',
} satisfies PaymentConfirmationEmailProps
