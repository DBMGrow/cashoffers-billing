import nodemailer from 'nodemailer'
import type { IConfig } from '@api/config/config.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type {
  IEmailService,
  SendEmailRequest,
  SendPlainEmailRequest,
} from '../email-service.interface'

/**
 * SMTP Email Service Implementation
 * For local development — routes emails through a local SMTP server (e.g. Mailpit, Mailhog).
 * HTML is expected to be pre-rendered by the caller (e.g. via React Email).
 */
export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter
  private fromEmail: string

  constructor(
    private config: IConfig,
    private logger: ILogger,
  ) {
    const smtp = config.smtp
    this.fromEmail = smtp?.fromEmail ?? config.sendgrid.fromEmail

    this.transporter = nodemailer.createTransport({
      host: smtp?.host ?? 'localhost',
      port: smtp?.port ?? 1025,
      secure: smtp?.secure ?? false,
      auth: smtp?.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined,
    })

    this.logger.debug('SMTP email service initialized', {
      host: smtp?.host ?? 'localhost',
      port: smtp?.port ?? 1025,
    })
  }

  async sendEmail(request: SendEmailRequest): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.info('Sending email (SMTP)', {
        to: request.to,
        templateName: request.templateName,
        subject: request.subject,
      })

      await this.sendPlainEmail({
        to: request.to,
        subject: request.subject,
        text: request.subject,
        html: request.html,
        fromName: request.fromName,
      })

      this.logger.info('Email sent successfully (SMTP)', {
        to: request.to,
        templateName: request.templateName,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      this.logger.error('Email sending failed (SMTP)', error, {
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
      this.logger.info('Sending plain email (SMTP)', {
        to: request.to,
        subject: request.subject,
      })

      const senderName = request.fromName ?? 'CashOffers'
      await this.transporter.sendMail({
        from: `"${senderName}" <${this.fromEmail}>`,
        to: request.to,
        subject: request.subject,
        text: request.text,
        html: request.html ?? request.text,
      })

      this.logger.info('Plain email sent successfully (SMTP)', {
        to: request.to,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      this.logger.error('Plain email sending failed (SMTP)', error, {
        to: request.to,
        duration: Date.now() - startTime,
      })
      throw error
    }
  }
}

/**
 * Create an SMTP email service
 */
export const createSmtpEmailService = (
  config: IConfig,
  logger: ILogger,
): IEmailService => {
  return new SmtpEmailService(config, logger)
}
