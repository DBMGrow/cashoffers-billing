/**
 * Email Service Interface
 * Abstracts email sending (SendGrid)
 */
export interface IEmailService {
  /**
   * Send an email using a template
   */
  sendEmail(request: SendEmailRequest): Promise<void>

  /**
   * Send a plain text email
   */
  sendPlainEmail(request: SendPlainEmailRequest): Promise<void>
}

/**
 * Send email request (with template)
 */
export interface SendEmailRequest {
  to: string
  subject: string
  template: string
  fields: Record<string, unknown>
}

/**
 * Send plain email request
 */
export interface SendPlainEmailRequest {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Email template names
 */
export type EmailTemplate =
  | 'subscriptionRenewal.html'
  | 'subscriptionRenewalFailed.html'
  | 'paymentReceipt.html'
  | 'subscriptionCreated.html'
  | 'subscriptionCancelled.html'
  | 'cardAdded.html'
  | 'cardUpdated.html'
  | 'daily-health-report.mjml'
