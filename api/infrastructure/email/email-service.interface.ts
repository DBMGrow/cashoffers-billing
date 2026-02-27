/**
 * Email Service Interface
 * Abstracts email sending (SendGrid, SMTP, Mock)
 */
export interface IEmailService {
  /**
   * Send an email using pre-rendered HTML
   */
  sendEmail(request: SendEmailRequest): Promise<void>

  /**
   * Send a plain text/HTML email directly
   */
  sendPlainEmail(request: SendPlainEmailRequest): Promise<void>
}

/**
 * Send email request — HTML is pre-rendered by the caller (e.g. via React Email)
 */
export interface SendEmailRequest {
  to: string
  subject: string
  /** Pre-rendered HTML string from React Email render() */
  html: string
  /** Template identifier for logging and mock filtering */
  templateName: string
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
