import nodemailer from 'nodemailer'
import type { IConfig } from '@api/config/config.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { IMjmlCompiler } from '@api/infrastructure/email/mjml/mjml-compiler.interface'
import type {
  IEmailService,
  SendEmailRequest,
  SendPlainEmailRequest,
} from '../email-service.interface'
import { parseEmailTemplate } from '../sendgrid/template-parser'

/**
 * SMTP Email Service Implementation
 * For local development — routes emails through a local SMTP server (e.g. Mailpit, Mailhog)
 */
export class SmtpEmailService implements IEmailService {
  private transporter: nodemailer.Transporter
  private fromEmail: string

  constructor(
    private config: IConfig,
    private logger: ILogger,
    private mjmlCompiler?: IMjmlCompiler
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
      this.logger.info('Sending email with template (SMTP)', {
        to: request.to,
        template: request.template,
        subject: request.subject,
      })

      const html = await parseEmailTemplate(
        request.template,
        { subject: request.subject, ...request.fields },
        this.mjmlCompiler
      )

      await this.sendPlainEmail({
        to: request.to,
        subject: request.subject,
        text: request.subject,
        html,
      })

      this.logger.info('Email sent successfully (SMTP)', {
        to: request.to,
        template: request.template,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      this.logger.error('Email sending failed (SMTP)', error, {
        to: request.to,
        template: request.template,
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

      await this.transporter.sendMail({
        from: `"CashOffers" <${this.fromEmail}>`,
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
  mjmlCompiler?: IMjmlCompiler
): IEmailService => {
  return new SmtpEmailService(config, logger, mjmlCompiler)
}
