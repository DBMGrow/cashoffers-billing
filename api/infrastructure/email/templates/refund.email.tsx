import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface RefundEmailProps {
  amount: string
  date: string
  isSandbox?: boolean
}

export default function RefundEmail({ amount, date, isSandbox }: RefundEmailProps) {
  return (
    <StandardEmail
      title="Transaction Refunded"
      preview={`Your refund of ${amount} has been processed.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Transaction Refunded</EmailHeading>
      <EmailDivider />
      <EmailText>Your transaction has been refunded.</EmailText>

      <SummaryTable>
        <SummaryRow label="Amount Refunded" value={amount} isTotal />
        <SummaryRow label="Transaction Date" value={date} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        The refund will appear on your statement within 5–10 business days.
      </EmailText>
    </StandardEmail>
  )
}

RefundEmail.PreviewProps = {
  amount: '$99.00',
  date: 'January 31, 2024',
} satisfies RefundEmailProps
