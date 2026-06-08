/**
 * Resolves the recipient list for the daily billing health report.
 *
 * Combines, in priority order:
 *   1. DEV_EMAIL (always primary)
 *   2. ADMIN_EMAIL (if configured)
 *   3. HEALTH_REPORT_RECIPIENTS (additional, comma-separated)
 *
 * Blank entries are dropped and duplicates are removed case-insensitively,
 * preserving first-seen order and original casing.
 */
export interface HealthReportRecipientsConfig {
  devEmail: string
  adminEmail?: string
  healthReportRecipients?: string[]
}

export function resolveHealthReportRecipients(email: HealthReportRecipientsConfig): string[] {
  const candidates = [
    email.devEmail,
    email.adminEmail,
    ...(email.healthReportRecipients ?? []),
  ]

  const seen = new Set<string>()
  const recipients: string[] = []
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push(trimmed)
  }
  return recipients
}
