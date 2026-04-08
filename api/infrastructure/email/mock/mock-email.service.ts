import type {
  IEmailService,
  SendEmailRequest,
  SendPlainEmailRequest,
} from '../email-service.interface'

/**
 * Sent email record
 */
export interface SentEmail {
  to: string
  subject: string
  templateName?: string
  html?: string
  text?: string
  sentAt: Date
}

/**
 * Mock Email Service
 * For testing without sending real emails
 */
export class MockEmailService implements IEmailService {
  private sentEmails: SentEmail[] = []

  // Configuration for testing different scenarios
  public shouldFail = false
  public failureReason = 'Mock email failed'

  async sendEmail(request: SendEmailRequest): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    this.sentEmails.push({
      to: request.to,
      subject: request.subject,
      templateName: request.templateName,
      html: request.html,
      sentAt: new Date(),
    })
  }

  async sendPlainEmail(request: SendPlainEmailRequest): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    this.sentEmails.push({
      to: request.to,
      subject: request.subject,
      text: request.text,
      html: request.html,
      sentAt: new Date(),
    })
  }

  // Test helpers
  getSentEmails(): SentEmail[] {
    return [...this.sentEmails]
  }

  getEmailsSentTo(email: string): SentEmail[] {
    return this.sentEmails.filter((e) => e.to === email)
  }

  getEmailsWithSubject(subject: string): SentEmail[] {
    return this.sentEmails.filter((e) => e.subject === subject)
  }

  getEmailsWithTemplate(templateName: string): SentEmail[] {
    return this.sentEmails.filter((e) => e.templateName === templateName)
  }

  reset(): void {
    this.sentEmails = []
    this.shouldFail = false
    this.failureReason = 'Mock email failed'
  }

  getLastEmail(): SentEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1]
  }
}

/**
 * Create a mock email service
 */
export const createMockEmailService = (): MockEmailService => {
  return new MockEmailService()
}
