import { Text } from "@react-email/components"
import { StandardEmail } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { colors, font, spacing, radius } from "./components/tokens"

export interface PurchaseSystemErrorEmailProps {
  flow: "new-user-purchase" | "existing-user-purchase"
  errorCode: string
  errorMessage: string
  errorStack?: string
  purchaseRequestId: number | null
  productId?: string | number | null
  email?: string | null
  userId?: number | null
  paymentId?: string | null
  subscriptionCreated?: boolean
  refundIssued?: boolean
  durationMs: number
  occurredAt: string
}

/**
 * Developer alert for system-level purchase failures (non-user-facing errors).
 * Sent when something unexpected breaks during a purchase — not for card declines.
 */
export default function PurchaseSystemErrorEmail({
  flow,
  errorCode,
  errorMessage,
  errorStack,
  purchaseRequestId,
  productId,
  email,
  userId,
  paymentId,
  subscriptionCreated,
  refundIssued,
  durationMs,
  occurredAt,
}: PurchaseSystemErrorEmailProps) {
  const flowLabel = flow === "new-user-purchase" ? "New User Purchase" : "Existing User Purchase"

  return (
    <StandardEmail
      title="Purchase System Error"
      preview={`System error during ${flowLabel}: ${errorCode} — ${email ?? userId ?? "unknown customer"}`}
    >
      <EmailHeading>Purchase System Error</EmailHeading>
      <EmailDivider />

      {/* Error summary */}
      <div
        style={{
          backgroundColor: colors.status.errorBg,
          border: `1px solid #fca5a5`,
          borderRadius: radius.md,
          padding: `${spacing.md} ${spacing.lg}`,
          marginBottom: spacing.lg,
        }}
      >
        <Text
          style={{
            margin: "0 0 4px 0",
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            color: colors.status.error,
          }}
        >
          {flowLabel} · {errorCode}
        </Text>
        <Text
          style={{
            margin: "0",
            fontSize: font.size.base,
            color: colors.text.body,
            lineHeight: font.lineHeight.normal,
          }}
        >
          {errorMessage}
        </Text>
      </div>

      <SummaryTable>
        <SummaryRow isHeader label="Purchase Context" value="" />
        <SummaryRow
          label="Purchase Request ID"
          value={purchaseRequestId != null ? String(purchaseRequestId) : "not created"}
        />
        <SummaryRow label="Product ID" value={productId != null ? String(productId) : "unknown"} />
        {userId != null && <SummaryRow label="User ID" value={String(userId)} />}
        <SummaryRow label="Customer Email" value={email ?? "unknown"} />
      </SummaryTable>
      <SummaryTable>
        <SummaryRow isHeader label="Payment State" value="" />
        <SummaryRow label="Payment ID" value={paymentId ?? "none (failed before payment)"} />
        <SummaryRow
          label="Subscription"
          value={subscriptionCreated ? "created — no refund (source of truth)" : "not created"}
        />
        <SummaryRow label="Refund Issued" value={refundIssued ? "yes" : "no"} />
        <SummaryRow isHeader label="Timing" value="" />
        <SummaryRow label="Occurred At" value={occurredAt} />
        <SummaryRow label="Duration" value={`${durationMs}ms`} bordered={false} />
      </SummaryTable>

      {/* Stack trace */}
      {errorStack && (
        <div
          style={{
            backgroundColor: "#1e1e1e",
            borderRadius: radius.md,
            padding: `${spacing.md} ${spacing.lg}`,
            marginTop: spacing.lg,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              margin: "0 0 8px 0",
              fontSize: font.size.xs,
              fontWeight: font.weight.semibold,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              color: "#9ca3af",
            }}
          >
            Stack Trace
          </Text>
          <Text
            style={{
              margin: "0",
              fontSize: "11px",
              color: "#f87171",
              fontFamily: "monospace",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {errorStack}
          </Text>
        </div>
      )}

      {/* Debug hint */}
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
            margin: "0 0 4px 0",
            fontSize: font.size.xs,
            fontWeight: font.weight.semibold,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            color: colors.text.muted,
          }}
        >
          Debug
        </Text>
        <Text
          style={{
            margin: "0",
            fontSize: font.size.sm,
            color: colors.text.body,
            fontFamily: "monospace",
            lineHeight: font.lineHeight.relaxed,
          }}
        >
          {`Search logs for: purchaseRequestId=${purchaseRequestId ?? "unknown"}`}
        </Text>
        <EmailText variant="muted" style={{ margin: "4px 0 0 0" }}>
          The customer was shown a generic error. This is a system error — not a card issue.
        </EmailText>
      </div>
    </StandardEmail>
  )
}

PurchaseSystemErrorEmail.PreviewProps = {
  flow: "new-user-purchase",
  errorCode: "PAYMENT_FAILED",
  errorMessage: "Payment status FAILED — Square returned an unexpected status",
  errorStack:
    "Error: Payment status FAILED\n    at processInitialPayment (purchase-helpers.ts:152)\n    at PurchaseNewUserUseCase.execute (purchase-new-user.use-case.ts:138)",
  purchaseRequestId: 42,
  productId: 5,
  email: "jane.doe@example.com",
  userId: null,
  paymentId: "sq_pay_abc123",
  subscriptionCreated: false,
  refundIssued: true,
  durationMs: 2341,
  occurredAt: "2024-01-31 14:23:01 UTC",
} satisfies PurchaseSystemErrorEmailProps
