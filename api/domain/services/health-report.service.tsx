import { render } from '@react-email/render'
import type { IHealthMetricsService, DailyHealthMetrics } from './health-metrics.service'
import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import DailyHealthReportEmail, {
  type DailyHealthReportEmailProps,
} from '@api/infrastructure/email/templates/daily-health-report.email'

/**
 * Health Report Service
 * Formats and sends daily health reports
 */
export interface IHealthReportService {
  sendDailyHealthReport(recipients: string[], date?: Date): Promise<void>
}

export class HealthReportService implements IHealthReportService {
  constructor(
    private healthMetricsService: IHealthMetricsService,
    private emailService: IEmailService,
    private logger: ILogger
  ) {}

  async sendDailyHealthReport(recipients: string[], date?: Date): Promise<void> {
    this.logger.info('Generating daily health report', {
      recipients,
      date: date?.toISOString(),
    })

    try {
      const metrics = await this.healthMetricsService.getDailyHealthMetrics(date)
      const props = this.buildEmailProps(metrics)
      const html = await render(<DailyHealthReportEmail {...props} />)
      const subject = `Daily Billing System Health Report - ${props.reportDate}`

      for (const recipient of recipients) {
        await this.emailService.sendEmail({
          to: recipient,
          subject,
          html,
          templateName: 'daily-health-report',
        })
      }

      this.logger.info('Daily health report sent successfully', {
        recipientCount: recipients.length,
      })
    } catch (error) {
      this.logger.error('Failed to send daily health report', error, { recipients })
      throw error
    }
  }

  private buildEmailProps(metrics: DailyHealthMetrics): DailyHealthReportEmailProps {
    const { overallStatus, statusMessage } = this.determineOverallStatus(metrics)

    const statusConfig = {
      good: { text: '✓ Healthy', color: '#16a34a' },
      warning: { text: '⚠ Warning', color: '#d97706' },
      critical: { text: '✗ Critical', color: '#dc2626' },
    }[overallStatus]

    return {
      reportDate: this.formatDate(metrics.reportDate),

      overallStatusText: statusConfig.text,
      overallStatusColor: statusConfig.color,
      statusMessage,

      totalRevenue: this.formatCurrency(metrics.payments.totalRevenue),
      averageTransactionValue: this.formatCurrency(metrics.payments.averageTransactionValue),

      successfulRenewals: metrics.subscriptions.successfulRenewals,
      failedRenewals: metrics.subscriptions.failedRenewals,
      failedRenewalsColor: metrics.subscriptions.failedRenewals > 5 ? '#dc2626' : '#6b7280',
      newSubscriptions: metrics.subscriptions.newSubscriptions,
      cancelledSubscriptions: metrics.subscriptions.cancelledSubscriptions,
      activeSubscriptions: metrics.subscriptions.activeSubscriptions,
      subscriptionsInRetry: metrics.subscriptions.subscriptionsInRetry,
      retryColor: metrics.subscriptions.subscriptionsInRetry > 10 ? '#d97706' : '#6b7280',
      pausedSubscriptions: metrics.subscriptions.pausedSubscriptions,

      successfulPayments: metrics.payments.successfulPayments,
      failedPayments: metrics.payments.failedPayments,
      failedPaymentsColor: metrics.payments.failedPayments > 5 ? '#dc2626' : '#6b7280',
      refunds: metrics.payments.refunds,

      totalErrors: metrics.errors.totalErrors,
      totalErrorsColor: metrics.errors.totalErrors > 10 ? '#d97706' : '#6b7280',
      criticalErrors: metrics.errors.criticalErrors,
      criticalErrorsColor: metrics.errors.criticalErrors > 0 ? '#dc2626' : '#16a34a',

      failureReasons: metrics.failureReasons.length > 0 ? metrics.failureReasons : undefined,
      recentErrors:
        metrics.errors.recentErrors.length > 0
          ? metrics.errors.recentErrors.map((err) => ({
              timestamp: new Date(err.timestamp).toLocaleString(),
              component: err.component,
              message: err.message,
            }))
          : undefined,
      actionItems: this.generateActionItems(metrics),
    }
  }

  private determineOverallStatus(metrics: DailyHealthMetrics): {
    overallStatus: 'good' | 'warning' | 'critical'
    statusMessage: string
  } {
    if (metrics.errors.criticalErrors > 0) {
      return {
        overallStatus: 'critical',
        statusMessage: `${metrics.errors.criticalErrors} critical error${metrics.errors.criticalErrors > 1 ? 's' : ''} detected. Immediate attention required.`,
      }
    }
    if (metrics.subscriptions.failedRenewals > 10) {
      return {
        overallStatus: 'critical',
        statusMessage: `High number of failed renewals (${metrics.subscriptions.failedRenewals}). System may be experiencing issues.`,
      }
    }
    if (metrics.errors.totalErrors > 20) {
      return {
        overallStatus: 'warning',
        statusMessage: `Elevated error count (${metrics.errors.totalErrors}). Monitor system closely.`,
      }
    }
    if (metrics.subscriptions.failedRenewals > 5) {
      return {
        overallStatus: 'warning',
        statusMessage: `${metrics.subscriptions.failedRenewals} failed renewals. Review failure reasons.`,
      }
    }
    if (metrics.subscriptions.subscriptionsInRetry > 15) {
      return {
        overallStatus: 'warning',
        statusMessage: `${metrics.subscriptions.subscriptionsInRetry} subscriptions in retry state.`,
      }
    }
    return { overallStatus: 'good', statusMessage: 'All systems operating normally.' }
  }

  private generateActionItems(metrics: DailyHealthMetrics): string[] | undefined {
    const items: string[] = []

    if (metrics.errors.criticalErrors > 0) {
      items.push(`• Review ${metrics.errors.criticalErrors} critical error(s) immediately`)
    }
    if (metrics.subscriptions.failedRenewals > 5) {
      items.push(`• Investigate ${metrics.subscriptions.failedRenewals} failed renewal(s) and contact affected users`)
    }
    if (metrics.subscriptions.subscriptionsInRetry > 15) {
      items.push(`• Monitor ${metrics.subscriptions.subscriptionsInRetry} subscription(s) in retry queue`)
    }
    if (metrics.payments.failedPayments > 10) {
      items.push(`• Review payment gateway logs for ${metrics.payments.failedPayments} failed payment(s)`)
    }
    if (metrics.errors.totalErrors > 20) {
      items.push(`• Review application logs - ${metrics.errors.totalErrors} errors logged today`)
    }

    return items.length > 0 ? items : undefined
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount / 100)
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }
}

export const createHealthReportService = (
  healthMetricsService: IHealthMetricsService,
  emailService: IEmailService,
  logger: ILogger
): IHealthReportService => {
  return new HealthReportService(healthMetricsService, emailService, logger)
}
