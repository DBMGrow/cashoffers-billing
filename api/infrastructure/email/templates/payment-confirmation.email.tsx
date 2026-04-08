import { StandardEmail, type WhitelabelBrandingProps } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface PaymentConfirmationEmailProps {
  amount: string
  transactionID: string
  date: string
  /** Optional description of what was purchased (e.g. property address for unlocks) */
  description?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function PaymentConfirmationEmail({
  amount,
  transactionID,
  date,
  description,
  isSandbox,
  whitelabel,
}: PaymentConfirmationEmailProps) {
  return (
    <StandardEmail
      title="Payment Successful"
      preview={`Your payment of ${amount} was processed successfully.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Payment Successful</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your payment has been processed successfully. Your card has been charged{' '}
        <strong>{amount}</strong>.
      </EmailText>

      <SummaryTable>
        <SummaryRow label="Transaction Date" value={date} bordered={false} />
        <SummaryRow label="Transaction ID" value={transactionID} bordered={false} />
      </SummaryTable>

      <SummaryTable>
        <SummaryRow isHeader label="Order Summary" value="" />
        <SummaryRow label={description ?? 'One-Time Payment'} value={amount} />
        <SummaryRow isTotal label="Total" value={amount} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        Thank you for your payment. Please keep this email as your receipt.
      </EmailText>
    </StandardEmail>
  )
}

PaymentConfirmationEmail.PreviewProps = {
  amount: '$99.00',
  transactionID: 'TXN-123456789',
  date: 'January 31, 2024',
  description: 'Property Unlock — 123 Main St, Springfield',
} satisfies PaymentConfirmationEmailProps
