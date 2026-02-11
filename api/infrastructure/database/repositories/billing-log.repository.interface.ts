import { Selectable } from 'kysely'
import { IRepository } from './repository.interface'
import type { BillingLogs } from '@/lib/db'

/**
 * Billing Log Repository Interface
 * Handles persistence of application logs
 */
export interface IBillingLogRepository extends IRepository<BillingLogs> {
  /**
   * Insert multiple log entries in a single bulk operation
   * Critical for performance when flushing queued logs
   */
  createMany(logs: Array<Omit<Selectable<BillingLogs>, 'log_id' | 'createdAt'>>): Promise<void>

  /**
   * Find all logs for a specific request
   * Useful for request tracing and debugging
   */
  findByRequestId(requestId: string): Promise<Selectable<BillingLogs>[]>

  /**
   * Find logs by date range with optional filters
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    filters?: {
      level?: 'debug' | 'info' | 'warn' | 'error'
      context_type?: 'http_request' | 'cron_job' | 'event_handler' | 'background'
      user_id?: number
      component?: string
    }
  ): Promise<Selectable<BillingLogs>[]>

  /**
   * Find logs by component
   */
  findByComponent(component: string, limit?: number): Promise<Selectable<BillingLogs>[]>

  /**
   * Find logs by user ID
   */
  findByUserId(userId: number, limit?: number): Promise<Selectable<BillingLogs>[]>

  /**
   * Find logs by level
   */
  findByLevel(
    level: 'debug' | 'info' | 'warn' | 'error',
    limit?: number
  ): Promise<Selectable<BillingLogs>[]>
}
