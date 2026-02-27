import { StandardEmail } from './components/standard-email'
import { EmailHeading } from './components/email-heading'
import { EmailDivider } from './components/email-divider'
import { EmailText } from './components/email-text'
import { SummaryTable } from './components/summary-table'
import { SummaryRow } from './components/summary-row'

export interface CardUpdatedEmailProps {
  /** Message describing the card action (added vs. updated) */
  message: string
  /** Masked card number e.g. "**** **** **** 4242" */
  card: string
  date: string
  isSandbox?: boolean
}

export default function CardUpdatedEmail({
  message,
  card,
  date,
  isSandbox,
}: CardUpdatedEmailProps) {
  return (
    <StandardEmail
      title="Payment Method Updated"
      preview={message}
      isSandbox={isSandbox}
    >
      <EmailHeading>Payment Method Updated</EmailHeading>
      <EmailDivider />
      <EmailText>{message}</EmailText>

      <SummaryTable>
        <SummaryRow label="Card Number" value={card} />
        <SummaryRow label="Updated On" value={date} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: '20px', marginBottom: '0' }}>
        If you have any questions about this update, please contact support.
      </EmailText>
    </StandardEmail>
  )
}

CardUpdatedEmail.PreviewProps = {
  message: 'Your payment method has been updated successfully.',
  card: '**** **** **** 4242',
  date: 'January 31, 2024',
} satisfies CardUpdatedEmailProps
