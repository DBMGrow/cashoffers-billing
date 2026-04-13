import type { TransactionRepository } from '@api/lib/repositories'
import type { SubscriptionRepository } from '@api/lib/repositories'
import type { BillingLogRepository } from '@api/lib/repositories'

/**
 * Health Metrics Service
 * Gathers system health metrics for daily reports and monitoring
 */
export interface IHealthMetricsService {
  /**
   * Get daily health metrics for the past 24 hours
   */
  getDailyHealthMetrics(date?: Date): Promise<DailyHealthMetrics>
}

/**
 * Daily health metrics
 */
export interface DailyHealthMetrics {
  // Date range for the report
  reportDate: Date
  startDate: Date
  endDate: Date

  // Subscription metrics
  subscriptions: {
    successfulRenewals: number
    failedRenewals: number
    newSubscriptions: number
    cancelledSubscriptions: number
    activeSubscriptions: number
    subscriptionsInRetry: number
    pausedSubscriptions: number
  }

  // Payment metrics
  payments: {
    totalRevenue: number
    successfulPayments: number
    failedPayments: number
    refunds: number
    averageTransactionValue: number
  }

  // Error metrics
  errors: {
    totalErrors: number
    criticalErrors: number
    recentErrors: ErrorSummary[]
  }

  // Top failure reasons
  failureReasons: FailureReason[]
}

/**
 * Error summary for reporting
 */
export interface ErrorSummary {
  timestamp: Date
  level: string
  component: string
  message: string
  userId?: number
}

/**
 * Payment failure reason
 */
export interface FailureReason {
  reason: string
  count: number
}

/**
 * Implementation of Health Metrics Service
 */
export class HealthMetricsService implements IHealthMetricsService {
  constructor(
    private transactionRepository: TransactionRepository,
    private subscriptionRepository: SubscriptionRepository,
    private billingLogRepository: BillingLogRepository
  ) {}

  async getDailyHealthMetrics(date?: Date): Promise<DailyHealthMetrics> {
    const reportDate = date || new Date()
    const endDate = new Date(reportDate)
    endDate.setHours(23, 59, 59, 999)

    const startDate = new Date(reportDate)
    startDate.setHours(0, 0, 0, 0)

    // Gather all metrics in parallel for efficiency
    const [
      subscriptionMetrics,
      paymentMetrics,
      errorMetrics,
      failureReasons,
    ] = await Promise.all([
      this.getSubscriptionMetrics(startDate, endDate),
      this.getPaymentMetrics(startDate, endDate),
      this.getErrorMetrics(startDate, endDate),
      this.getFailureReasons(startDate, endDate),
    ])

    return {
      reportDate,
      startDate,
      endDate,
      subscriptions: subscriptionMetrics,
      payments: paymentMetrics,
      errors: errorMetrics,
      failureReasons,
    }
  }

  private async getSubscriptionMetrics(startDate: Date, endDate: Date) {
    // Get renewal transactions
    const renewalTransactions = await this.transactionRepository.findByDateRange(
      startDate,
      endDate
    )

    const successfulRenewals = renewalTransactions.filter(
      (t: any) => t.type === 'renewal' && t.status === 'success'
    ).length

    const failedRenewals = renewalTransactions.filter(
      (t: any) => t.type === 'renewal' && t.status === 'failed'
    ).length

    const newSubscriptions = renewalTransactions.filter(
      (t: any) => t.type === 'purchase' && t.status === 'success'
    ).length

    const cancelledSubscriptions = renewalTransactions.filter(
      (t: any) => t.type === 'cancellation'
    ).length

    // Get current subscription counts
    const allSubscriptions = await this.subscriptionRepository.findAll()
    const activeSubscriptions = allSubscriptions.filter((s: any) => s.status === 'active').length
    const subscriptionsInRetry = allSubscriptions.filter(
      (s: any) => (s.payment_failure_count ?? 0) > 0 && s.status === 'active'
    ).length
    const pausedSubscriptions = allSubscriptions.filter((s: any) => s.status === 'paused').length

    return {
      successfulRenewals,
      failedRenewals,
      newSubscriptions,
      cancelledSubscriptions,
      activeSubscriptions,
      subscriptionsInRetry,
      pausedSubscriptions,
    }
  }

  private async getPaymentMetrics(startDate: Date, endDate: Date) {
    const transactions = await this.transactionRepository.findByDateRange(
      startDate,
      endDate
    )

    const successfulPayments = transactions.filter(
      (t: any) => ['purchase', 'renewal'].includes(t.type) && t.status === 'success'
    )

    const failedPayments = transactions.filter(
      (t: any) => ['purchase', 'renewal'].includes(t.type) && t.status === 'failed'
    ).length

    const refunds = transactions.filter((t: any) => t.type === 'refund').length

    const totalRevenue = successfulPayments.reduce(
      (sum: number, t: any) => sum + Number(t.amount || 0),
      0
    )

    const averageTransactionValue =
      successfulPayments.length > 0 ? totalRevenue / successfulPayments.length : 0

    return {
      totalRevenue,
      successfulPayments: successfulPayments.length,
      failedPayments,
      refunds,
      averageTransactionValue,
    }
  }

  private async getErrorMetrics(startDate: Date, endDate: Date) {
    const logs = await this.billingLogRepository.findByDateRange(startDate, endDate)

    const errorLogs = logs.filter((log: any) => log.level === 'error')
    const criticalErrors = errorLogs.filter(
      (log: any) =>
        log.message.toLowerCase().includes('square') ||
        log.message.toLowerCase().includes('database') ||
        log.message.toLowerCase().includes('api') ||
        log.message.toLowerCase().includes('critical')
    )

    // Get top 10 most recent errors
    const recentErrors: ErrorSummary[] = errorLogs
      .slice(-10)
      .reverse()
      .map((log: any) => ({
        timestamp: log.createdAt,
        level: log.level,
        component: log.component || 'unknown',
        message: log.message,
        userId: log.user_id || undefined,
      }))

    return {
      totalErrors: errorLogs.length,
      criticalErrors: criticalErrors.length,
      recentErrors,
    }
  }

  private async getFailureReasons(startDate: Date, endDate: Date) {
    const transactions = await this.transactionRepository.findByDateRange(
      startDate,
      endDate
    )

    const failedTransactions = transactions.filter((t: any) => t.status === 'failed')

    // Group by failure reason
    const reasonCounts = new Map<string, number>()

    for (const transaction of failedTransactions) {
      if (transaction.data) {
        try {
          const data = JSON.parse(transaction.data)
          const reason = data.error || data.message || 'Unknown error'
          reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1)
        } catch {
          reasonCounts.set('Unknown error', (reasonCounts.get('Unknown error') || 0) + 1)
        }
      } else {
        reasonCounts.set('Unknown error', (reasonCounts.get('Unknown error') || 0) + 1)
      }
    }

    // Convert to array and sort by count
    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 reasons
  }
}

/**
 * Factory function to create health metrics service
 */
export const createHealthMetricsService = (
  transactionRepository: TransactionRepository,
  subscriptionRepository: SubscriptionRepository,
  billingLogRepository: BillingLogRepository
): IHealthMetricsService => {
  return new HealthMetricsService(
    transactionRepository,
    subscriptionRepository,
    billingLogRepository
  )
}
