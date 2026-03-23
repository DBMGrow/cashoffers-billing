import { Text } from "@react-email/components"
import { StandardEmail } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { InfoBox } from "./components/info-box"
import { colors, font, spacing, radius } from "./components/tokens"

export interface UserProvisioningFailedEmailProps {
  subscriptionId: number
  purchaseRequestId: number
  email: string
  productId: number
  errorDetail: string
  occurredAt: string
}

/**
 * Admin alert sent when user provisioning fails after a successful payment.
 * The customer was charged and a subscription record exists, but no user
 * account was created — manual intervention is required.
 */
export default function UserProvisioningFailedEmail({
  subscriptionId,
  purchaseRequestId,
  email,
  productId,
  errorDetail,
  occurredAt,
}: UserProvisioningFailedEmailProps) {
  return (
    <StandardEmail
      title="User Provisioning Failed"
      preview={`Action required: user provisioning failed for ${email} — subscription #${subscriptionId}`}
    >
      <EmailHeading>User Provisioning Failed</EmailHeading>
      <EmailDivider />
      <EmailText>
        A new-user purchase completed payment and created a subscription, but user account creation
        failed. The customer was charged but has no account and cannot log in.
      </EmailText>

      <SummaryTable>
        <SummaryRow isHeader label="Customer" value="" />
        <SummaryRow label="Email" value={email} />
        <SummaryRow label="Product ID" value={String(productId)} />
        <SummaryRow isHeader label="Records" value="" />
        <SummaryRow label="Subscription ID" value={String(subscriptionId)} />
        <SummaryRow label="Purchase Request ID" value={String(purchaseRequestId)} />
        <SummaryRow label="Provisioning Status" value="pending_provisioning" />
        <SummaryRow isHeader label="Failure" value="" />
        <SummaryRow label="Occurred At" value={occurredAt} bordered={false} />
      </SummaryTable>

      {/* Error detail */}
      <div
        style={{
          backgroundColor: colors.bg.subtle,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.md} ${spacing.lg}`,
          marginTop: spacing.lg,
        }}
      >
        <Text
          style={{
            margin: "0 0 6px 0",
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            color: colors.text.muted,
          }}
        >
          Error Detail
        </Text>
        <Text
          style={{
            margin: "0",
            fontSize: font.size.sm,
            color: colors.status.error,
            fontFamily: "monospace",
            lineHeight: font.lineHeight.relaxed,
            wordBreak: "break-word",
          }}
        >
          {errorDetail}
        </Text>
      </div>

      <InfoBox variant="warning" title="What to do">
        {[
          `1. Search logs for purchaseRequestId=${purchaseRequestId}`,
          `2. Manually create the user account in the main API for ${email}`,
          `3. Bind the user_id to subscription #${subscriptionId}`,
          `4. Update provisioning_status to 'provisioned'`,
        ].join("\n")}
      </InfoBox>
    </StandardEmail>
  )
}

UserProvisioningFailedEmail.PreviewProps = {
  subscriptionId: 1042,
  purchaseRequestId: 87,
  email: "jane.doe@example.com",
  productId: 5,
  errorDetail: "POST https://api.cashoffers.com/users 503 Service Unavailable",
  occurredAt: "2024-01-31 14:23:01 UTC",
} satisfies UserProvisioningFailedEmailProps
