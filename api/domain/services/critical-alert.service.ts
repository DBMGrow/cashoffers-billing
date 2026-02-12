import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { IConfig } from '@api/config/config.interface'

/**
 * Critical Alert Service
 * Sends immediate notifications for critical system errors
 */
export interface ICriticalAlertService {
  /**
   * Send alert for Square API failure
   */
  alertSquareApiFailure(error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send alert for Main API connectivity issues
   */
  alertMainApiFailure(error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send alert for database errors
   */
  alertDatabaseError(error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send alert for email service failures
   */
  alertEmailServiceFailure(error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send alert for critical payment processing errors
   */
  alertPaymentProcessingError(error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send alert for cron job failures
   */
  alertCronJobFailure(jobName: string, error: Error, context?: Record<string, unknown>): Promise<void>

  /**
   * Send generic critical error alert
   */
  alertCriticalError(
    errorType: string,
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void>
}

/**
 * Error severity levels
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}

/**
 * Implementation of Critical Alert Service
 */
export class CriticalAlertService implements ICriticalAlertService {
  // Track recent alerts to prevent spam (alert type -> timestamp)
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
    // For email failures, we can't send an email alert, so we just log
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
    // Check if we've sent this alert recently to prevent spam
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

    this.logger.warn('Sending critical alert', {
      alertType,
      severity,
      errorMessage: error.message,
    })

    try {
      const emailContent = this.formatAlertEmail(
        alertType,
        severity,
        description,
        error,
        context
      )

      // Send to dev email (primary) and admin email (fallback)
      const recipients: string[] = []
      if (this.config.email.devEmail) {
        recipients.push(this.config.email.devEmail)
      }
      if (this.config.email.adminEmail && this.config.email.adminEmail !== this.config.email.devEmail) {
        recipients.push(this.config.email.adminEmail)
      }

      // Ensure we have at least one recipient
      if (recipients.length === 0) {
        throw new Error('No email recipients configured for alerts')
      }

      for (const recipient of recipients) {
        await this.emailService.sendPlainEmail({
          to: recipient,
          subject: `🚨 ${severity}: ${alertType}`,
          text: emailContent.text,
          html: emailContent.html,
        })
      }

      // Update recent alerts map
      this.recentAlerts.set(alertKey, now)

      // Clean up old entries (older than cooldown period)
      for (const [key, timestamp] of this.recentAlerts.entries()) {
        if (now - timestamp > this.ALERT_COOLDOWN_MS) {
          this.recentAlerts.delete(key)
        }
      }

      this.logger.info('Critical alert sent successfully', {
        alertType,
        recipientCount: recipients.length,
      })
    } catch (alertError) {
      // If we can't send the alert, at least log it
      this.logger.error('Failed to send critical alert', alertError, {
        originalError: error.message,
        alertType,
      })
    }
  }

  private formatAlertEmail(
    alertType: string,
    severity: AlertSeverity,
    description: string,
    error: Error,
    context?: Record<string, unknown>
  ): { text: string; html: string } {
    const timestamp = new Date().toISOString()
    const environment = this.config.environment || 'unknown'

    // Plain text version
    const text = `
CRITICAL ALERT: ${alertType}
Severity: ${severity}
Environment: ${environment}
Time: ${timestamp}

${description}

ERROR DETAILS:
${error.message}

${error.stack || 'No stack trace available'}

CONTEXT:
${context ? JSON.stringify(context, null, 2) : 'No additional context'}

---
This is an automated alert from the CashOffers Billing System.
Please investigate immediately.
    `.trim()

    // HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Courier New', monospace; margin: 20px; }
    .alert-box {
      border: 3px solid #ef4444;
      border-radius: 8px;
      padding: 20px;
      background-color: #fef2f2;
      margin-bottom: 20px;
    }
    .severity {
      color: #dc2626;
      font-weight: bold;
      font-size: 24px;
    }
    .section {
      background-color: #fff;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
      border-left: 4px solid #3b82f6;
    }
    .section-title {
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 10px;
    }
    pre {
      background-color: #f3f4f6;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .meta {
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="alert-box">
    <div class="severity">🚨 ${severity} ALERT</div>
    <h2>${alertType}</h2>
    <div class="meta">
      <strong>Environment:</strong> ${environment}<br>
      <strong>Time:</strong> ${timestamp}
    </div>
  </div>

  ${description ? `<div class="section"><div class="section-title">Description</div>${description}</div>` : ''}

  <div class="section">
    <div class="section-title">Error Details</div>
    <strong>Message:</strong> ${error.message}<br><br>
    <strong>Stack Trace:</strong>
    <pre>${error.stack || 'No stack trace available'}</pre>
  </div>

  ${context ? `
    <div class="section">
      <div class="section-title">Context</div>
      <pre>${JSON.stringify(context, null, 2)}</pre>
    </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Action Required</div>
    ${context?.action || 'Please investigate this error immediately and take appropriate action.'}
  </div>

  <hr>
  <p class="meta">
    This is an automated alert from the CashOffers Billing System.
  </p>
</body>
</html>
    `.trim()

    return { text, html }
  }
}

/**
 * Factory function to create critical alert service
 */
export const createCriticalAlertService = (
  emailService: IEmailService,
  config: IConfig,
  logger: ILogger
): ICriticalAlertService => {
  return new CriticalAlertService(emailService, config, logger)
}
