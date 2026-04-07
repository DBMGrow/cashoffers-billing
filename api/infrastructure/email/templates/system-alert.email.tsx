import { Text } from "@react-email/components"
import { StandardEmail } from "./components/standard-email"
import { EmailHeading } from "./components/email-heading"
import { EmailDivider } from "./components/email-divider"
import { EmailText } from "./components/email-text"
import { SummaryTable } from "./components/summary-table"
import { SummaryRow } from "./components/summary-row"
import { InfoBox } from "./components/info-box"
import { colors, font, spacing, radius } from "./components/tokens"

export interface HttpErrorDetails {
  method: string
  url: string
  status?: number
  statusText?: string
  responseBody?: string
  requestPayload?: string
}

export interface SystemAlertEmailProps {
  alertType: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM"
  description?: string
  errorMessage: string
  errorStack?: string
  environment: string
  occurredAt: string
  context?: Record<string, unknown>
  httpDetails?: HttpErrorDetails
}

/**
 * System alert email for developer/admin notifications.
 * Replaces the old inline-HTML critical alert format with a clean,
 * consistent template that matches the rest of the system.
 */
export default function SystemAlertEmail({
  alertType,
  severity,
  description,
  errorMessage,
  errorStack,
  environment,
  occurredAt,
  context,
  httpDetails,
}: SystemAlertEmailProps) {
  const severityLabel =
    severity === "CRITICAL" ? "Critical" : severity === "HIGH" ? "High" : "Medium"

  return (
    <StandardEmail
      title={`System Alert: ${alertType}`}
      preview={`${severityLabel} alert: ${alertType} — ${errorMessage.slice(0, 80)}`}
    >
      <EmailHeading>System Alert</EmailHeading>
      <EmailDivider />

      <SummaryTable>
        <SummaryRow isHeader label="Alert" value="" />
        <SummaryRow label="Type" value={alertType} />
        <SummaryRow label="Severity" value={severityLabel} />
        <SummaryRow label="Environment" value={environment} />
        <SummaryRow label="Time" value={occurredAt} bordered={false} />
      </SummaryTable>

      {description && <EmailText>{description}</EmailText>}

      {/* Error detail */}
      <div
        style={{
          backgroundColor: colors.status.errorBg,
          border: "1px solid #fca5a5",
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
          Error
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

      {/* HTTP request/response details (for API errors) */}
      {httpDetails && (
        <SummaryTable>
          <SummaryRow isHeader label="HTTP Request" value="" />
          <SummaryRow label="Method" value={httpDetails.method.toUpperCase()} />
          <SummaryRow label="URL" value={httpDetails.url} />
          {httpDetails.status != null && (
            <SummaryRow
              label="Response Status"
              value={`${httpDetails.status}${httpDetails.statusText ? ` ${httpDetails.statusText}` : ""}`}
            />
          )}
          {httpDetails.responseBody && (
            <SummaryRow label="Response Body" value="" bordered={false} />
          )}
          {httpDetails.requestPayload && !httpDetails.responseBody && (
            <SummaryRow label="" value="" bordered={false} />
          )}
        </SummaryTable>
      )}

      {httpDetails?.responseBody && (
        <div
          style={{
            backgroundColor: colors.bg.subtle,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.md} ${spacing.lg}`,
            marginBottom: spacing.lg,
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
            Response Body
          </Text>
          <Text
            style={{
              margin: "0",
              fontSize: font.size.sm,
              color: colors.text.body,
              fontFamily: "monospace",
              lineHeight: font.lineHeight.relaxed,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {httpDetails.responseBody}
          </Text>
        </div>
      )}

      {httpDetails?.requestPayload && (
        <div
          style={{
            backgroundColor: colors.bg.subtle,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.md} ${spacing.lg}`,
            marginBottom: spacing.lg,
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
            Request Payload
          </Text>
          <Text
            style={{
              margin: "0",
              fontSize: font.size.sm,
              color: colors.text.body,
              fontFamily: "monospace",
              lineHeight: font.lineHeight.relaxed,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {httpDetails.requestPayload}
          </Text>
        </div>
      )}

      {/* Context */}
      {context && Object.keys(context).length > 0 && (
        <SummaryTable>
          <SummaryRow isHeader label="Context" value="" />
          {Object.entries(context).map(([key, value], i, arr) => (
            <SummaryRow
              key={key}
              label={key}
              value={typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
              bordered={i < arr.length - 1}
            />
          ))}
        </SummaryTable>
      )}

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

      {context?.action && (
        <InfoBox variant="info" title="Recommended Action">
          {String(context.action)}
        </InfoBox>
      )}
    </StandardEmail>
  )
}

SystemAlertEmail.PreviewProps = {
  alertType: "HomeUptick API Failure During Renewal",
  severity: "CRITICAL",
  description: "The HomeUptick API returned an error while fetching contact count during subscription renewal.",
  errorMessage: "Request failed with status code 401",
  errorStack:
    "AxiosError: Request failed with status code 401\n    at settle (node_modules/axios/lib/core/settle.js:19:12)\n    at HomeUptickApiClient.getClientCount (homeuptick-api.client.ts:72:26)",
  environment: "production",
  occurredAt: "2026-04-07 13:37:28 UTC",
  context: {
    subscriptionId: 122,
    userId: 1270,
    email: "user@example.com",
    impact: "Renewal aborted — no payment was charged",
    action: "Investigate HomeUptick API availability and retry renewal manually",
  },
  httpDetails: {
    method: "GET",
    url: "https://homeuptick.com/api/clients/count",
    status: 401,
    statusText: "Unauthorized",
    responseBody: '{"error":"Invalid or expired API token","code":"AUTH_FAILED"}',
  },
} satisfies SystemAlertEmailProps
