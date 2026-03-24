import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { LineItemsTable, type LineItem } from "./components/line-items-table"

export interface SubscriptionCreatedEmailProps {
  subscription: string
  amount: string
  lineItems: LineItem[]
  date: string
  transactionID?: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function SubscriptionCreatedEmail({
  subscription,
  amount,
  lineItems = [],
  date,
  transactionID,
  isSandbox,
  whitelabel,
}: SubscriptionCreatedEmailProps) {
  const brandName = whitelabel?.name ?? 'CashOffers'
  return (
    <StandardEmail
      title="Subscription Created"
      preview={`Welcome to ${brandName}! Your ${subscription} subscription is now active.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
    >
      <EmailHeading>Subscription Created</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your new subscription has been created, and your card has been charged <strong>{amount}</strong>.
      </EmailText>

      <SummaryTable>
        <SummaryRow label="Transaction Date" value={date} bordered={false} />
        {transactionID && <SummaryRow label="Transaction ID" value={transactionID} bordered={false} />}
      </SummaryTable>

      <SummaryTable>
        <SummaryRow isHeader label="Order Summary" value="" />

        <LineItemsTable items={lineItems} />
        <SummaryRow isTotal label="Total" value={amount} bordered={false} />
      </SummaryTable>

      <EmailText variant="muted" style={{ marginTop: "20px", marginBottom: "0" }}>
        Welcome to {brandName}. Your {subscription} subscription is now active.
      </EmailText>
    </StandardEmail>
  )
}

SubscriptionCreatedEmail.PreviewProps = {
  subscription: "Premium Monthly",
  amount: "$99.00",
  transactionID: "txn_1234567890",
  lineItems: [{ description: "Premium Monthly Subscription", amount: 9900 }],
  date: "January 31, 2024",
} satisfies SubscriptionCreatedEmailProps
