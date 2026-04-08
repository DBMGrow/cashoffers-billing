import { render } from '@react-email/render'
import axios from 'axios'
import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { IConfig } from '@api/config/config.interface'
import SystemAlertEmail from '@api/infrastructure/email/templates/system-alert.email'
import type { HttpErrorDetails } from '@api/infrastructure/email/templates/system-alert.email'

/**
 * Critical Alert Service
 * Sends immediate notifications for critical system errors
 */
export interface ICriticalAlertService {
  alertSquareApiFailure(error: Error, context?: Record<string, unknown>): Promise<void>
  alertMainApiFailure(error: Error, context?: Record<string, unknown>): Promise<void>
  alertDatabaseError(error: Error, context?: Record<string, unknown>): Promise<void>
  alertEmailServiceFailure(error: Error, context?: Record<string, unknown>): Promise<void>
  alertPaymentProcessingError(error: Error, context?: Record<string, unknown>): Promise<void>
  alertCronJobFailure(jobName: string, error: Error, context?: Record<string, unknown>): Promise<void>
  alertCriticalError(errorType: string, error: Error, context?: Record<string, unknown>): Promise<void>
}

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}

export class CriticalAlertService implements ICriticalAlertService {
  private recentAlerts: Map<string, number> = new Map()
  private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

  constructor(
    private emailService: IEmailService,
    private config: IConfig,
    private logger: ILogger
  ) {}

  async alertSquareApiFailure(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.sendCriticalAlert(
      'Square API Failure',
      AlertSeverity.CRITICAL,
      'The Square payment API is not responding or returning errors. Payment processing may be affected.',
      error,
      {
        ...context,
        impact: 'Payment processing disrupted',
        action: 'Check Square API status and credentials',
      }
    )
  }

  async alertMainApiFailure(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.sendCriticalAlert(
      'Main API Connectivity Failure',
      AlertSeverity.CRITICAL,
      'Cannot connect to the main CashOffers API. User data retrieval and updates are failing.',
      error,
      {
        ...context,
        impact: 'User operations blocked',
        action: 'Verify main API status and network connectivity',
      }
    )
  }

  async alertDatabaseError(error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.sendCriticalAlert(
      'Database Error',
      AlertSeverity.CRITICAL,
      'Database connection or query failure detected. Data operations may be failing.',
      error,
      {
        ...context,
        impact: 'Data operations may be failing',
        action: 'Check database status and connection pool',
      }
    )
  }

  async alertEmailServiceFailure(error: Error, context?: Record<string, unknown>): Promise<void> {
    this.logger.error('Email service failure - cannot send alert', error, context)
  }

  async alertPaymentProcessingError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.sendCriticalAlert(
      'Payment Processing Error',
      AlertSeverity.HIGH,
      'A critical error occurred during payment processing.',
      error,
      {
        ...context,
        impact: 'Payment may have failed',
        action: 'Review transaction logs and contact affected user',
      }
    )
  }

  async alertCronJobFailure(
    jobName: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.sendCriticalAlert(
      `Cron Job Failure: ${jobName}`,
      AlertSeverity.HIGH,
      `The scheduled job "${jobName}" has failed to complete successfully.`,
      error,
      {
        ...context,
        jobName,
        impact: 'Scheduled operations not completed',
        action: 'Review cron logs and restart job if needed',
      }
    )
  }

  async alertCriticalError(
    errorType: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.sendCriticalAlert(errorType, AlertSeverity.CRITICAL, '', error, context)
  }

  private async sendCriticalAlert(
    alertType: string,
    severity: AlertSeverity,
    description: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    const alertKey = `${alertType}:${error.message}`
    const lastAlertTime = this.recentAlerts.get(alertKey)
    const now = Date.now()

    if (lastAlertTime && now - lastAlertTime < this.ALERT_COOLDOWN_MS) {
      this.logger.debug('Skipping duplicate alert (cooldown period)', {
        alertType,
        lastAlertTime: new Date(lastAlertTime).toISOString(),
      })
      return
    }

    this.logger.warn('Sending system alert', {
      alertType,
      severity,
      errorMessage: error.message,
    })

    try {
      const environment = this.config.environment || 'unknown'
      const occurredAt = new Date().toISOString()

      // Extract HTTP details from Axios errors for better debugging
      let httpDetails: HttpErrorDetails | undefined
      let enrichedMessage = error.message
      if (axios.isAxiosError(error)) {
        httpDetails = {
          method: error.config?.method || 'unknown',
          url: error.config?.url || 'unknown',
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseBody: error.response?.data
            ? typeof error.response.data === 'string'
              ? error.response.data
              : JSON.stringify(error.response.data, null, 2)
            : undefined,
          requestPayload: error.config?.data
            ? typeof error.config.data === 'string'
              ? error.config.data
              : JSON.stringify(error.config.data, null, 2)
            : undefined,
        }
        // Build a more descriptive error message
        enrichedMessage = `${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status ?? 'no response'}`
        if (error.response?.statusText) {
          enrichedMessage += ` ${error.response.statusText}`
        }
      }

      const html = await render(
        <SystemAlertEmail
          alertType={alertType}
          severity={severity}
          description={description || undefined}
          errorMessage={enrichedMessage}
          errorStack={error.stack}
          environment={environment}
          occurredAt={occurredAt}
          context={context}
          httpDetails={httpDetails}
        />
      )

      const severityLabel =
        severity === AlertSeverity.CRITICAL ? 'Critical' : severity === AlertSeverity.HIGH ? 'High' : 'Medium'

      // Send to dev email (primary) and admin email (fallback)
      const recipients: string[] = []
      if (this.config.email.devEmail) {
        recipients.push(this.config.email.devEmail)
      }
      if (this.config.email.adminEmail && this.config.email.adminEmail !== this.config.email.devEmail) {
        recipients.push(this.config.email.adminEmail)
      }

      if (recipients.length === 0) {
        throw new Error('No email recipients configured for alerts')
      }

      for (const recipient of recipients) {
        await this.emailService.sendEmail({
          to: recipient,
          subject: `${severityLabel} Alert: ${alertType}`,
          html,
          templateName: 'system-alert',
        })
      }

      this.recentAlerts.set(alertKey, now)

      // Clean up old entries
      for (const [key, timestamp] of this.recentAlerts.entries()) {
        if (now - timestamp > this.ALERT_COOLDOWN_MS) {
          this.recentAlerts.delete(key)
        }
      }

      this.logger.info('System alert sent successfully', {
        alertType,
        recipientCount: recipients.length,
      })
    } catch (alertError) {
      this.logger.error('Failed to send system alert', alertError, {
        originalError: error.message,
        alertType,
      })
    }
  }
}

export const createCriticalAlertService = (
  emailService: IEmailService,
  config: IConfig,
  logger: ILogger
): ICriticalAlertService => {
  return new CriticalAlertService(emailService, config, logger)
}
