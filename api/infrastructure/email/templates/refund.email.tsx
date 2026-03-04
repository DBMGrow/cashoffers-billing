import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'
import { InfoBox } from './components/info-box'

export interface RefundEmailProps {
  amount: string
  date: string
  transactionId?: string
  isSandbox?: boolean
}

export default function RefundEmail({ amount, date, transactionId, isSandbox }: RefundEmailProps) {
  return (
    <StandardEmail
      title="Transaction Refunded"
      preview={`Your refund of ${amount} has been processed.`}
      isSandbox={isSandbox}
    >
      <EmailHeading>Transaction Refunded</EmailHeading>
      <EmailDivider />
      <EmailText>Your refund has been processed successfully.</EmailText>

      <SummaryTable>
        <SummaryRow label="Refund Date" value={date} bordered={false} />
        {transactionId && <SummaryRow label="Transaction ID" value={transactionId} bordered={false} />}
      </SummaryTable>

      <SummaryTable>
        <SummaryRow isHeader label="Refund Summary" value="" />
        <SummaryRow isTotal label="Amount Refunded" value={amount} bordered={false} />
      </SummaryTable>

      <InfoBox variant="info" title="Processing Time">
        Refunds typically appear on your statement within 5–10 business days, depending on your
        bank or card issuer.
      </InfoBox>
    </StandardEmail>
  )
}

RefundEmail.PreviewProps = {
  amount: '$99.00',
  date: 'January 31, 2024',
  transactionId: 'TXN-123456789',
} satisfies RefundEmailProps
