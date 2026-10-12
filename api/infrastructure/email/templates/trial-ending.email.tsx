import { StandardEmail, type WhitelabelBrandingProps } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { ActionButton } from "./components/action-button"
import { InfoBox } from "./components/info-box"

/**
 * Sent once, 7 days before a card-on-file free trial (Desk #1350) converts: the card will be
 * charged. Distinct from `trial-expiring.email.tsx`, which tells a HomeUptick trialer (no card)
 * that access is ending.
 */
export interface TrialEndingEmailProps {
  /** The plan the charge is for, e.g. "InstantOffers365 Individual" */
  subscription: string
  /** The first charge: `Subscriptions.amount`, formatted. Never a constant, each plan has its own. */
  amount: string
  /** The day the trial ends and the card is charged, formatted */
  chargeDate: string
  /** Last four digits of the card on file; omitted when no card row was found */
  cardLast4?: string
  /** Where the agent updates the card or cancels */
  manageUrl: string
  isSandbox?: boolean
  whitelabel?: WhitelabelBrandingProps
}

export default function TrialEndingEmail({
  subscription,
  amount,
  chargeDate,
  cardLast4,
  manageUrl,
  isSandbox,
  whitelabel,
}: TrialEndingEmailProps) {
  const card = cardLast4 ? `the card ending ${cardLast4}` : "your card on file"
  return (
    <StandardEmail
      title="Your Free Trial Ends Soon"
      preview={`Your free trial ends on ${chargeDate}. We'll charge ${amount} to ${card} that day.`}
      isSandbox={isSandbox}
      whitelabel={whitelabel}
      showChargeNotice
    >
      <EmailHeading>Your Free Trial Ends Soon</EmailHeading>
      <EmailDivider />
      <EmailText>
        Your free trial ends on <strong>{chargeDate}</strong>. We&apos;ll charge <strong>{amount}</strong> to {card}{" "}
        that day, and your plan continues without interruption.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Upcoming Charge" value="" />
        <SummaryRow label="Plan" value={subscription} />
        <SummaryRow label="Charge Date" value={chargeDate} />
        {cardLast4 && <SummaryRow label="Card" value={`Ending in ${cardLast4}`} />}
        <SummaryRow isTotal label="Amount" value={amount} bordered={false} />
      </SummaryTable>

      <InfoBox variant="info" title="Not ready to continue?">
        To cancel before then, open your billing page and cancel your plan before {chargeDate}. You won&apos;t be
        charged.
      </InfoBox>

      <ActionButton href={manageUrl}>Manage Billing</ActionButton>
    </StandardEmail>
  )
}

TrialEndingEmail.PreviewProps = {
  subscription: "InstantOffers365 Individual",
  amount: "$250.00",
  chargeDate: "November 11, 2026",
  cardLast4: "4242",
  manageUrl: "https://account.cashoffers.pro/manage",
} satisfies TrialEndingEmailProps
