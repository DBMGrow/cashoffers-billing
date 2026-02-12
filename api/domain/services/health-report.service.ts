import type { IHealthMetricsService, DailyHealthMetrics } from './health-metrics.service'
import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'

/**
 * Health Report Service
 * Formats and sends daily health reports
 */
export interface IHealthReportService {
  /**
   * Generate and send daily health report
   */
  sendDailyHealthReport(recipients: string[], date?: Date): Promise<void>
}

/**
 * Implementation of Health Report Service
 */
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
      // Gather metrics
      const metrics = await this.healthMetricsService.getDailyHealthMetrics(date)

      // Format the report
      const reportFields = this.formatReportFields(metrics)

      // Send to each recipient
      for (const recipient of recipients) {
        await this.emailService.sendEmail({
          to: recipient,
          subject: `Daily Billing System Health Report - ${this.formatDate(metrics.reportDate)}`,
          template: 'daily-health-report.mjml',
          fields: reportFields,
        })
      }

      this.logger.info('Daily health report sent successfully', {
        recipientCount: recipients.length,
      })
    } catch (error) {
      this.logger.error('Failed to send daily health report', error, {
        recipients,
      })
      throw error
    }
  }

  private formatReportFields(metrics: DailyHealthMetrics): Record<string, unknown> {
    // Determine overall status
    const { overallStatus, statusMessage } = this.determineOverallStatus(metrics)

    // Format currency
    const totalRevenue = this.formatCurrency(metrics.payments.totalRevenue)
    const averageTransactionValue = this.formatCurrency(
      metrics.payments.averageTransactionValue
    )

    // Format failure reasons
    const failureReasonsText = metrics.failureReasons
      .map((fr) => `• ${fr.reason}: ${fr.count} occurrence${fr.count > 1 ? 's' : ''}`)
      .join('\n')

    // Format recent errors
    const recentErrorsText = metrics.errors.recentErrors
      .map((err) => {
        const timestamp = new Date(err.timestamp).toLocaleString()
        return `[${timestamp}] ${err.component}: ${err.message}`
      })
      .join('\n')

    // Generate action items
    const actionItems = this.generateActionItems(metrics)
    const actionItemsText = actionItems.join('\n')

    return {
      // Date info
      reportDate: this.formatDate(metrics.reportDate),
      currentYear: new Date().getFullYear(),
      emailTitle: 'Daily Health Report',

      // Overall status
      overallStatus: overallStatus === 'good' ? 'status-good' :
                     overallStatus === 'warning' ? 'status-warning' : 'status-critical',
      overallStatusText: overallStatus === 'good' ? '✓ Healthy' :
                         overallStatus === 'warning' ? '⚠ Warning' : '✗ Critical',
      statusMessage,

      // Revenue
      totalRevenue,
      averageTransactionValue,

      // Subscriptions
      successfulRenewals: metrics.subscriptions.successfulRenewals,
      failedRenewals: metrics.subscriptions.failedRenewals,
      newSubscriptions: metrics.subscriptions.newSubscriptions,
      cancelledSubscriptions: metrics.subscriptions.cancelledSubscriptions,
      activeSubscriptions: metrics.subscriptions.activeSubscriptions,
      subscriptionsInRetry: metrics.subscriptions.subscriptionsInRetry,
      pausedSubscriptions: metrics.subscriptions.pausedSubscriptions,

      // Payments
      successfulPayments: metrics.payments.successfulPayments,
      failedPayments: metrics.payments.failedPayments,
      refunds: metrics.payments.refunds,

      // Errors
      totalErrors: metrics.errors.totalErrors,
      criticalErrors: metrics.errors.criticalErrors,

      // Colors based on thresholds
      failedRenewalsColor: metrics.subscriptions.failedRenewals > 5 ? '#ef4444' : '#6b7280',
      retryColor: metrics.subscriptions.subscriptionsInRetry > 10 ? '#f59e0b' : '#6b7280',
      failedPaymentsColor: metrics.payments.failedPayments > 5 ? '#ef4444' : '#6b7280',
      totalErrorsColor: metrics.errors.totalErrors > 10 ? '#f59e0b' : '#6b7280',
      criticalErrorsColor: metrics.errors.criticalErrors > 0 ? '#ef4444' : '#10b981',

      // Lists
      hasFailureReasons: metrics.failureReasons.length > 0,
      failureReasonsText,
      hasRecentErrors: metrics.errors.recentErrors.length > 0,
      recentErrorsText,
      hasActionItems: actionItems.length > 0,
      actionItemsText,
    }
  }

  private determineOverallStatus(metrics: DailyHealthMetrics): {
    overallStatus: 'good' | 'warning' | 'critical'
    statusMessage: string
  } {
    // Critical conditions
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

    // Warning conditions
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

    // All good
    return {
      overallStatus: 'good',
      statusMessage: 'All systems operating normally.',
    }
  }

  private generateActionItems(metrics: DailyHealthMetrics): string[] {
    const items: string[] = []

    if (metrics.errors.criticalErrors > 0) {
      items.push(`• Review ${metrics.errors.criticalErrors} critical error(s) immediately`)
    }

    if (metrics.subscriptions.failedRenewals > 5) {
      items.push(
        `• Investigate ${metrics.subscriptions.failedRenewals} failed renewal(s) and contact affected users`
      )
    }

    if (metrics.subscriptions.subscriptionsInRetry > 15) {
      items.push(
        `• Monitor ${metrics.subscriptions.subscriptionsInRetry} subscription(s) in retry queue`
      )
    }

    if (metrics.payments.failedPayments > 10) {
      items.push(`• Review payment gateway logs for ${metrics.payments.failedPayments} failed payment(s)`)
    }

    if (metrics.errors.totalErrors > 20) {
      items.push(`• Review application logs - ${metrics.errors.totalErrors} errors logged today`)
    }

    return items
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount / 100) // Amount is in cents
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }
}

/**
 * Factory function to create health report service
 */
export const createHealthReportService = (
  healthMetricsService: IHealthMetricsService,
  emailService: IEmailService,
  logger: ILogger
): IHealthReportService => {
  return new HealthReportService(healthMetricsService, emailService, logger)
}
