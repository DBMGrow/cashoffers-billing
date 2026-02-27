import sgMail from '@sendgrid/mail'
import type { IConfig } from '@api/config/config.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type {
  IEmailService,
  SendEmailRequest,
  SendPlainEmailRequest,
} from '../email-service.interface'

/**
 * SendGrid Email Service Implementation
 * Handles email sending via SendGrid API.
 * HTML is expected to be pre-rendered by the caller (e.g. via React Email).
 */
export class SendGridEmailService implements IEmailService {
  constructor(
    private config: IConfig,
    private logger: ILogger,
  ) {
    sgMail.setApiKey(config.sendgrid.apiKey)
    this.logger.debug('SendGrid email service initialized')
  }

  async sendEmail(request: SendEmailRequest): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Sending email', {
        to: request.to,
        templateName: request.templateName,
        subject: request.subject,
      })

      await this.sendPlainEmail({
        to: request.to,
        subject: request.subject,
        text: request.subject,
        html: request.html,
      })

      this.logger.info('Email sent successfully', {
        to: request.to,
        templateName: request.templateName,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      this.logger.error('Email sending failed', error, {
        to: request.to,
        templateName: request.templateName,
        duration: Date.now() - startTime,
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

      this.logger.info('Plain email sent successfully', {
        to: request.to,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      this.logger.error('Plain email sending failed', error, {
        to: request.to,
        duration: Date.now() - startTime,
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
  logger: ILogger,
): IEmailService => {
  return new SendGridEmailService(config, logger)
}
