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
      failedRenewalsColor: (() => {
        const { renewalFailureRate } = this.computeRates(metrics)
        const total = metrics.subscriptions.successfulRenewals + metrics.subscriptions.failedRenewals
        if (renewalFailureRate > 0.25 && total >= 5) return '#dc2626'
        if (renewalFailureRate > 0.10 && total >= 5) return '#d97706'
        return '#6b7280'
      })(),
      newSubscriptions: metrics.subscriptions.newSubscriptions,
      cancelledSubscriptions: metrics.subscriptions.cancelledSubscriptions,
      activeSubscriptions: metrics.subscriptions.activeSubscriptions,
      subscriptionsInRetry: metrics.subscriptions.subscriptionsInRetry,
      retryColor: (() => {
        const { retryRate } = this.computeRates(metrics)
        if (retryRate > 0.05 && metrics.subscriptions.subscriptionsInRetry >= 3) return '#d97706'
        return '#6b7280'
      })(),
      pausedSubscriptions: metrics.subscriptions.pausedSubscriptions,

      successfulPayments: metrics.payments.successfulPayments,
      failedPayments: metrics.payments.failedPayments,
      failedPaymentsColor: (() => {
        const { paymentFailureRate } = this.computeRates(metrics)
        if (paymentFailureRate > 0.10 && metrics.payments.failedPayments >= 5) return '#dc2626'
        return '#6b7280'
      })(),
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
    const { renewalFailureRate, retryRate } = this.computeRates(metrics)

    if (metrics.errors.criticalErrors > 0) {
      return {
        overallStatus: 'critical',
        statusMessage: `${metrics.errors.criticalErrors} critical error${metrics.errors.criticalErrors > 1 ? 's' : ''} detected. Immediate attention required.`,
      }
    }
    // Critical: >25% renewal failure rate with at least 5 attempts
    const totalRenewals = metrics.subscriptions.successfulRenewals + metrics.subscriptions.failedRenewals
    if (renewalFailureRate > 0.25 && totalRenewals >= 5) {
      return {
        overallStatus: 'critical',
        statusMessage: `${Math.round(renewalFailureRate * 100)}% renewal failure rate (${metrics.subscriptions.failedRenewals}/${totalRenewals}). System may be experiencing issues.`,
      }
    }
    if (metrics.errors.totalErrors > 20) {
      return {
        overallStatus: 'warning',
        statusMessage: `Elevated error count (${metrics.errors.totalErrors}). Monitor system closely.`,
      }
    }
    // Warning: >10% renewal failure rate with at least 5 attempts
    if (renewalFailureRate > 0.10 && totalRenewals >= 5) {
      return {
        overallStatus: 'warning',
        statusMessage: `${Math.round(renewalFailureRate * 100)}% renewal failure rate (${metrics.subscriptions.failedRenewals}/${totalRenewals}). Review failure reasons.`,
      }
    }
    // Warning: >5% of active subscriptions in retry
    if (retryRate > 0.05 && metrics.subscriptions.subscriptionsInRetry >= 3) {
      return {
        overallStatus: 'warning',
        statusMessage: `${Math.round(retryRate * 100)}% of active subscriptions in retry (${metrics.subscriptions.subscriptionsInRetry}/${metrics.subscriptions.activeSubscriptions}).`,
      }
    }
    return { overallStatus: 'good', statusMessage: 'All systems operating normally.' }
  }

  private computeRates(metrics: DailyHealthMetrics) {
    const totalRenewals = metrics.subscriptions.successfulRenewals + metrics.subscriptions.failedRenewals
    const renewalFailureRate = totalRenewals > 0
      ? metrics.subscriptions.failedRenewals / totalRenewals
      : 0

    const retryRate = metrics.subscriptions.activeSubscriptions > 0
      ? metrics.subscriptions.subscriptionsInRetry / metrics.subscriptions.activeSubscriptions
      : 0

    const totalPayments = metrics.payments.successfulPayments + metrics.payments.failedPayments
    const paymentFailureRate = totalPayments > 0
      ? metrics.payments.failedPayments / totalPayments
      : 0

    return { renewalFailureRate, retryRate, paymentFailureRate }
  }

  private generateActionItems(metrics: DailyHealthMetrics): string[] | undefined {
    const items: string[] = []
    const { renewalFailureRate, retryRate, paymentFailureRate } = this.computeRates(metrics)
    const totalRenewals = metrics.subscriptions.successfulRenewals + metrics.subscriptions.failedRenewals

    if (metrics.errors.criticalErrors > 0) {
      items.push(`• Review ${metrics.errors.criticalErrors} critical error(s) immediately`)
    }
    if (renewalFailureRate > 0.10 && totalRenewals >= 5) {
      items.push(`• Investigate ${Math.round(renewalFailureRate * 100)}% renewal failure rate (${metrics.subscriptions.failedRenewals} failed) and contact affected users`)
    }
    if (retryRate > 0.05 && metrics.subscriptions.subscriptionsInRetry >= 3) {
      items.push(`• Monitor ${metrics.subscriptions.subscriptionsInRetry} subscription(s) in retry queue (${Math.round(retryRate * 100)}% of active)`)
    }
    if (paymentFailureRate > 0.10 && metrics.payments.failedPayments >= 5) {
      items.push(`• Review payment gateway logs — ${Math.round(paymentFailureRate * 100)}% payment failure rate (${metrics.payments.failedPayments} failed)`)
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
