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

    let startDate: Date
    let endDate: Date

    if (date) {
      // Explicit date: use that day's midnight-to-midnight window
      startDate = new Date(reportDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(reportDate)
      endDate.setHours(23, 59, 59, 999)
    } else {
      // No date specified: last 24 hours ending now
      endDate = new Date(reportDate)
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
    }

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

  private isSuccessStatus(status: string | null): boolean {
    return status === 'completed' || status === 'success'
  }

  private parseMetadata(metadata: unknown): Record<string, unknown> | null {
    if (!metadata) return null
    if (typeof metadata === 'object') return metadata as Record<string, unknown>
    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }
    return null
  }

  private isNewSubscriptionTransaction(t: any): boolean {
    // New subscription transactions have "Subscription created" in the memo
    return t.type === 'subscription' && typeof t.memo === 'string' &&
      /subscription created/i.test(t.memo)
  }

  private isSubscriptionLifecycleEvent(t: any): boolean {
    // Non-renewal subscription events: creates, updates, pauses, resumes
    if (t.type !== 'subscription' || typeof t.memo !== 'string') return false
    return /subscription (created|updated|paused|resumed)/i.test(t.memo)
  }

  private isRenewalTransaction(t: any): boolean {
    // Renewal transactions are subscription-type records that are NOT lifecycle
    // events (creates, updates, pauses, resumes). This covers:
    //   - Successful: memo is the subscription name (e.g. "Premium CashOffers")
    //   - Failed: memo ends with "(failed)" or "(new card declined)"
    return t.type === 'subscription' && !this.isSubscriptionLifecycleEvent(t)
  }

  private async getSubscriptionMetrics(startDate: Date, endDate: Date) {
    const transactions = await this.transactionRepository.findByDateRange(
      startDate,
      endDate
    )

    const successfulRenewals = transactions.filter(
      (t: any) => this.isRenewalTransaction(t) && this.isSuccessStatus(t.status)
    ).length

    const failedRenewals = transactions.filter(
      (t: any) => this.isRenewalTransaction(t) && t.status === 'failed'
    ).length

    const newSubscriptions = transactions.filter(
      (t: any) => this.isNewSubscriptionTransaction(t) && this.isSuccessStatus(t.status)
    ).length

    // Get current subscription counts
    const allSubscriptions = await this.subscriptionRepository.findAll()
    const activeSubscriptions = allSubscriptions.filter((s: any) => s.status === 'active').length
    const subscriptionsInRetry = allSubscriptions.filter(
      (s: any) => (s.payment_failure_count ?? 0) > 0 && s.status === 'active'
    ).length
    const pausedSubscriptions = allSubscriptions.filter((s: any) => s.status === 'paused').length

    // Count subscriptions cancelled within the report period (by updatedAt)
    const cancelledSubscriptions = allSubscriptions.filter(
      (s: any) => s.status === 'cancelled' && s.updatedAt >= startDate && s.updatedAt <= endDate
    ).length

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

    // Payment types that represent real monetary transactions
    const monetaryTypes = ['payment', 'subscription', 'property_unlock']

    const successfulPayments = transactions.filter(
      (t: any) => monetaryTypes.includes(t.type) && this.isSuccessStatus(t.status) && Number(t.amount || 0) > 0
    )

    const failedPayments = transactions.filter(
      (t: any) => monetaryTypes.includes(t.type) && t.status === 'failed'
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

    // "Critical" in the daily report = platform/config/infra failures that need
    // developer attention. It should NOT include expected downstream noise from
    // normal user card declines (which cascade into Square/renewal error logs).
    const criticalErrors = errorLogs.filter((log: any) => {
      const metadata = this.parseMetadata(log.metadata)
      // Explicitly flagged critical Square platform errors (token/config/outage)
      if (metadata?.criticalSquareError === true) return true
      // Database/connection failures
      const msg = String(log.message || '').toLowerCase()
      if (msg.includes('database') || msg.includes('connection refused')) return true
      if (msg.includes('critical')) return true
      return false
    })

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
