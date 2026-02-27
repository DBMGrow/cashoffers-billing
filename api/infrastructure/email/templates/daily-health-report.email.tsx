import { Section, Text, Row, Column } from "@react-email/components"
import { EmailLayout } from "./components/email-layout"
import { EmailHeader } from "./components/email-header"
import { EmailFooter } from "./components/email-footer"
import { MetricRow, MetricCard } from "./components/metric-row"
import { InfoBox } from "./components/info-box"
import { colors, font, spacing, radius } from "./components/tokens"

export interface DailyHealthReportEmailProps {
  reportDate: string

  // Overall status
  overallStatusText: string
  overallStatusColor: string
  statusMessage: string

  // Revenue
  totalRevenue: string
  averageTransactionValue: string

  // Subscription metrics
  successfulRenewals: number
  failedRenewals: number
  failedRenewalsColor: string
  newSubscriptions: number
  cancelledSubscriptions: number
  activeSubscriptions: number
  subscriptionsInRetry: number
  retryColor: string
  pausedSubscriptions: number

  // Payment metrics
  successfulPayments: number
  failedPayments: number
  failedPaymentsColor: string
  refunds: number

  // Error metrics
  totalErrors: number
  totalErrorsColor: string
  criticalErrors: number
  criticalErrorsColor: string

  // Conditional sections
  failureReasons?: Array<{ reason: string; count: number }>
  recentErrors?: Array<{ timestamp: string; component: string; message: string }>
  actionItems?: string[]
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px 0",
        fontSize: font.size.lg,
        fontWeight: font.weight.semibold,
        color: colors.text.heading,
        borderBottom: `2px solid ${colors.border}`,
        paddingBottom: "8px",
      }}
    >
      {children}
    </Text>
  )
}

function ReportSection({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: colors.bg.card,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        padding: `${spacing.xl} ${spacing.xl}`,
        marginBottom: spacing.md,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Daily billing system health report email.
 * Standalone template (not using StandardEmail) — has its own blue header
 * and multi-section layout. Sent to admins only.
 *
 * Unlike the old MJML template, JSX conditionals work correctly here.
 */
export default function DailyHealthReportEmail({
  reportDate,
  overallStatusText,
  overallStatusColor,
  statusMessage,
  totalRevenue,
  averageTransactionValue,
  successfulRenewals,
  failedRenewals,
  failedRenewalsColor,
  newSubscriptions,
  cancelledSubscriptions,
  activeSubscriptions,
  subscriptionsInRetry,
  retryColor,
  pausedSubscriptions,
  successfulPayments,
  failedPayments,
  failedPaymentsColor,
  refunds,
  totalErrors,
  totalErrorsColor,
  criticalErrors,
  criticalErrorsColor,
  failureReasons,
  recentErrors,
  actionItems,
}: DailyHealthReportEmailProps) {
  return (
    <EmailLayout title="Daily Health Report" preview={`Billing system health report for ${reportDate}`}>
      {/* Brand header */}
      <Section style={{ paddingTop: "26px" }}>
        <Text
          style={{
            margin: "0 0 4px 0",
            textAlign: "left",
            fontSize: "26px",
            fontWeight: font.weight.bold,
            color: colors.text.heading,
            lineHeight: font.lineHeight.tight,
          }}
        >
          Daily Health Report
        </Text>
        <Text
          style={{
            margin: "0",
            textAlign: "left",
            fontSize: font.size.lg,
            color: colors.text.muted,
          }}
        >
          {reportDate}
        </Text>
      </Section>

      <div style={{ padding: `${spacing.md} 0` }}>
        {/* Overall Status */}
        <ReportSection>
          <SectionHeader>System Status</SectionHeader>
          <Text
            style={{
              margin: "0 0 8px 0",
              textAlign: "center",
              fontSize: "36px",
              fontWeight: font.weight.bold,
              color: overallStatusColor,
              lineHeight: font.lineHeight.tight,
            }}
          >
            {overallStatusText}
          </Text>
          <Text
            style={{
              margin: "0",
              textAlign: "center",
              fontSize: font.size.base,
              color: colors.text.muted,
            }}
          >
            {statusMessage}
          </Text>
        </ReportSection>

        {/* Key Metrics */}
        <ReportSection>
          <Row>
            <Column style={{ width: "33%" }}>
              <MetricCard label="Total Revenue" value={totalRevenue} valueColor={colors.status.success} />
            </Column>
            <Column style={{ width: "33%" }}>
              <MetricCard label="Successful Renewals" value={String(successfulRenewals)} />
            </Column>
            <Column style={{ width: "33%" }}>
              <MetricCard label="Failed Renewals" value={String(failedRenewals)} valueColor={failedRenewalsColor} />
            </Column>
          </Row>
        </ReportSection>

        {/* Subscription Metrics */}
        <ReportSection>
          <SectionHeader>Subscription Metrics</SectionHeader>
          <MetricRow label="New Subscriptions" value={String(newSubscriptions)} />
          <MetricRow label="Cancelled Subscriptions" value={String(cancelledSubscriptions)} />
          <MetricRow label="Active Subscriptions" value={String(activeSubscriptions)} />
          <MetricRow label="Subscriptions in Retry" value={String(subscriptionsInRetry)} valueColor={retryColor} />
          <MetricRow label="Paused Subscriptions" value={String(pausedSubscriptions)} />
        </ReportSection>

        {/* Payment Metrics */}
        <ReportSection>
          <SectionHeader>Payment Metrics</SectionHeader>
          <MetricRow label="Successful Payments" value={String(successfulPayments)} />
          <MetricRow label="Failed Payments" value={String(failedPayments)} valueColor={failedPaymentsColor} />
          <MetricRow label="Refunds Processed" value={String(refunds)} />
          <MetricRow label="Avg Transaction Value" value={averageTransactionValue} />
        </ReportSection>

        {/* Error Metrics */}
        <ReportSection>
          <SectionHeader>Error Metrics</SectionHeader>
          <MetricRow label="Total Errors" value={String(totalErrors)} valueColor={totalErrorsColor} />
          <MetricRow label="Critical Errors" value={String(criticalErrors)} valueColor={criticalErrorsColor} />
        </ReportSection>

        {/* Top Failure Reasons — only renders if data present */}
        {failureReasons && failureReasons.length > 0 && (
          <ReportSection>
            <SectionHeader>Top Failure Reasons</SectionHeader>
            {failureReasons.map((fr, i) => (
              <MetricRow key={i} label={fr.reason} value={`${fr.count} occurrence${fr.count > 1 ? "s" : ""}`} />
            ))}
          </ReportSection>
        )}

        {/* Recent Errors — only renders if data present */}
        {recentErrors && recentErrors.length > 0 && (
          <ReportSection>
            <SectionHeader>Recent Errors (Last {recentErrors.length})</SectionHeader>
            {recentErrors.map((err, i) => (
              <div key={i} style={{ marginBottom: spacing.sm }}>
                <Text
                  style={{
                    margin: "0",
                    fontSize: font.size.xs,
                    color: colors.text.muted,
                    fontFamily: "monospace",
                  }}
                >
                  [{err.timestamp}] {err.component}: {err.message}
                </Text>
              </div>
            ))}
          </ReportSection>
        )}

        {/* Action Items — only renders if data present */}
        {actionItems && actionItems.length > 0 && (
          <InfoBox variant="warning" title="⚠ Action Required">
            {actionItems.join("\n")}
          </InfoBox>
        )}
      </div>

      <EmailFooter />
    </EmailLayout>
  )
}

DailyHealthReportEmail.PreviewProps = {
  reportDate: "January 31, 2024",
  overallStatusText: "HEALTHY",
  overallStatusColor: "#16a34a",
  statusMessage: "All systems are operating normally.",
  totalRevenue: "$4,850.00",
  averageTransactionValue: "$97.00",
  successfulRenewals: 48,
  failedRenewals: 2,
  failedRenewalsColor: "#dc2626",
  newSubscriptions: 5,
  cancelledSubscriptions: 1,
  activeSubscriptions: 312,
  subscriptionsInRetry: 2,
  retryColor: "#d97706",
  pausedSubscriptions: 4,
  successfulPayments: 50,
  failedPayments: 2,
  failedPaymentsColor: "#dc2626",
  refunds: 1,
  totalErrors: 3,
  totalErrorsColor: "#d97706",
  criticalErrors: 0,
  criticalErrorsColor: "#16a34a",
  failureReasons: [{ reason: "Card declined", count: 2 }],
  recentErrors: [
    { timestamp: "2024-01-31 14:23:01", component: "RenewalCron", message: "Payment failed for subscription #1042" },
  ],
  actionItems: ["Review 2 failed renewals and retry manually if needed."],
} satisfies DailyHealthReportEmailProps
