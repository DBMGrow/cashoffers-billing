import sgMail from '@sendgrid/mail'
import type { IConfig } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type {
  IEmailService,
  SendEmailRequest,
  SendPlainEmailRequest,
} from '../email-service.interface'
import { parseEmailTemplate } from './template-parser'

/**
 * SendGrid Email Service Implementation
 * Handles email sending via SendGrid API
 */
export class SendGridEmailService implements IEmailService {
  constructor(
    private config: IConfig,
    private logger: ILogger
  ) {
    sgMail.setApiKey(config.sendgrid.apiKey)
    this.logger.debug('SendGrid email service initialized')
  }

  async sendEmail(request: SendEmailRequest): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Sending email with template', {
        to: request.to,
        template: request.template,
        subject: request.subject,
      })

      // Parse template with fields
      const html = await parseEmailTemplate(request.template, {
        subject: request.subject,
        ...request.fields,
      })

      await this.sendPlainEmail({
        to: request.to,
        subject: request.subject,
        text: request.subject,
        html,
      })

      const duration = Date.now() - startTime
      this.logger.info('Email sent successfully', {
        to: request.to,
        template: request.template,
        duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Email sending failed', error, {
        to: request.to,
        template: request.template,
        duration,
      })
      throw error
    }
  }

  async sendPlainEmail(request: SendPlainEmailRequest): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Sending plain email', {
        to: request.to,
        subject: request.subject,
      })

      const msg = {
        to: request.to,
        from: {
          email: this.config.sendgrid.fromEmail,
          name: 'CashOffers',
        },
        subject: request.subject,
        text: request.text,
        html: request.html || request.text,
        bcc: this.config.sendgrid.fromEmail, // BCC to system email for record keeping
      }

      await sgMail.send(msg)

      const duration = Date.now() - startTime
      this.logger.info('Plain email sent successfully', {
        to: request.to,
        duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Plain email sending failed', error, {
        to: request.to,
        duration,
      })
      throw error
    }
  }
}

/**
 * Create a SendGrid email service
 */
export const createSendGridEmailService = (
  config: IConfig,
  logger: ILogger
): IEmailService => {
  return new SendGridEmailService(config, logger)
}
