import { Entity } from "../base/entity.interface"
import { PurchaseRequestStatus } from "../value-objects/purchase-request-status"
import { Email } from "../value-objects/email"

/**
 * Purchase Request Type
 */
export enum PurchaseRequestType {
  NEW_PURCHASE = "NEW_PURCHASE",
  RENEWAL = "RENEWAL",
  UPGRADE = "UPGRADE",
}

/**
 * Purchase Request Source
 */
export enum PurchaseRequestSource {
  API = "API",
  CRON = "CRON",
  ADMIN = "ADMIN",
}

/**
 * Purchase Request Completion Results
 */
export interface PurchaseRequestResults {
  subscriptionId: number | null
  transactionId: number | null
  amountCharged: number | null
  cardId: string | null
}

/**
 * Purchase Request Props
 */
export interface PurchaseRequestProps {
  id: number
  requestUuid: string
  requestType: PurchaseRequestType
  source: PurchaseRequestSource

  // Core identifiers
  userId: number | null
  email: Email
  productId: number
  subscriptionId: number | null

  // Input data
  requestData: Record<string, unknown>

  // Status tracking
  status: PurchaseRequestStatus

  // Error tracking
  failureReason: string | null
  errorCode: string | null
  retryCount: number
  maxRetries: number
  nextRetryAt: Date | null

  // Results
  results: PurchaseRequestResults

  // Metadata
  idempotencyKey: string | null
  userCreated: boolean
  proratedAmount: number | null

  // Audit timestamps
  startedAt: Date | null
  completedAt: Date | null
  processingDurationMs: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * PurchaseRequest Domain Entity
 *
 * Business Rules:
 * - Status transitions must follow valid workflow
 * - Cannot mark as completed without subscription result
 * - Retry count cannot exceed max retries
 * - Terminal statuses (COMPLETED, FAILED) cannot be changed
 * - Each request must have a unique UUID for idempotency
 */
export class PurchaseRequest extends Entity<number> {
  private constructor(private props: PurchaseRequestProps) {
    super(props.id, props.createdAt, props.updatedAt)
    this.validate()
  }

  /**
   * Create a new purchase request
   */
  static create(
    props: Omit<PurchaseRequestProps, "id" | "createdAt" | "updatedAt" | "status" | "results" | "startedAt" | "completedAt" | "processingDurationMs" | "failureReason" | "errorCode" | "retryCount" | "nextRetryAt">
  ): PurchaseRequest {
    const now = new Date()
    return new PurchaseRequest({
      ...props,
      id: 0, // Will be set by database
      status: PurchaseRequestStatus.pending(),
      results: {
        subscriptionId: null,
        transactionId: null,
        amountCharged: null,
        cardId: null,
      },
      failureReason: null,
      errorCode: null,
      retryCount: 0,
      nextRetryAt: null,
      startedAt: null,
      completedAt: null,
      processingDurationMs: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * Reconstitute purchase request from persistence
   */
  static from(props: PurchaseRequestProps): PurchaseRequest {
    return new PurchaseRequest(props)
  }

  // Getters
  get requestUuid(): string {
    return this.props.requestUuid
  }

  get requestType(): PurchaseRequestType {
    return this.props.requestType
  }

  get source(): PurchaseRequestSource {
    return this.props.source
  }

  get userId(): number | null {
    return this.props.userId
  }

  get email(): Email {
    return this.props.email
  }

  get productId(): number {
    return this.props.productId
  }

  get subscriptionId(): number | null {
    return this.props.subscriptionId
  }

  get requestData(): Record<string, unknown> {
    return this.props.requestData
  }

  get status(): PurchaseRequestStatus {
    return this.props.status
  }

  get failureReason(): string | null {
    return this.props.failureReason
  }

  get errorCode(): string | null {
    return this.props.errorCode
  }

  get retryCount(): number {
    return this.props.retryCount
  }

  get maxRetries(): number {
    return this.props.maxRetries
  }

  get nextRetryAt(): Date | null {
    return this.props.nextRetryAt
  }

  get results(): PurchaseRequestResults {
    return this.props.results
  }

  get idempotencyKey(): string | null {
    return this.props.idempotencyKey
  }

  get userCreated(): boolean {
    return this.props.userCreated
  }

  get proratedAmount(): number | null {
    return this.props.proratedAmount
  }

  get startedAt(): Date | null {
    return this.props.startedAt
  }

  get completedAt(): Date | null {
    return this.props.completedAt
  }

  get processingDurationMs(): number | null {
    return this.props.processingDurationMs
  }

  // Predicates
  isCompleted(): boolean {
    return this.props.status.isCompleted()
  }

  isFailed(): boolean {
    return this.props.status.isFailed()
  }

  isPending(): boolean {
    return this.props.status.isPending()
  }

  isInProgress(): boolean {
    return this.props.status.isInProgress()
  }

  isTerminal(): boolean {
    return this.props.status.isTerminal()
  }

  canRetry(): boolean {
    return this.props.status.canRetry() && this.props.retryCount < this.props.maxRetries
  }

  isNewPurchase(): boolean {
    return this.props.requestType === PurchaseRequestType.NEW_PURCHASE
  }

  isRenewal(): boolean {
    return this.props.requestType === PurchaseRequestType.RENEWAL
  }

  isUpgrade(): boolean {
    return this.props.requestType === PurchaseRequestType.UPGRADE
  }

  // Business Methods

  /**
   * Mark request as started and transition to validating
   * Business Rule: Can only start from pending status
   */
  markAsStarted(): PurchaseRequest {
    if (!this.isPending()) {
      throw new Error(`Cannot start purchase request in ${this.status.value} status`)
    }

    return new PurchaseRequest({
      ...this.props,
      status: PurchaseRequestStatus.validating(),
      startedAt: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Transition to a new status
   * Business Rule: Must follow valid status transition rules
   */
  transitionTo(newStatus: PurchaseRequestStatus): PurchaseRequest {
    if (this.isTerminal()) {
      throw new Error(`Cannot change status of terminal purchase request (current: ${this.status.value})`)
    }

    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status.value} to ${newStatus.value}`)
    }

    return new PurchaseRequest({
      ...this.props,
      status: newStatus,
      updatedAt: new Date(),
    })
  }

  /**
   * Mark request as completed with results
   * Business Rule: Must have subscription result, cannot complete from terminal status
   */
  markAsCompleted(results: PurchaseRequestResults, startTime: Date): PurchaseRequest {
    if (this.isTerminal()) {
      throw new Error(`Cannot complete terminal purchase request (current: ${this.status.value})`)
    }

    if (!results.subscriptionId) {
      throw new Error("Cannot complete purchase request without subscription result")
    }

    const completedAt = new Date()
    const duration = completedAt.getTime() - startTime.getTime()

    return new PurchaseRequest({
      ...this.props,
      status: PurchaseRequestStatus.completed(),
      results,
      completedAt,
      processingDurationMs: duration,
      updatedAt: new Date(),
    })
  }

  /**
   * Mark request as failed
   * Business Rule: Cannot fail from completed status
   */
  markAsFailed(reason: string, errorCode?: string): PurchaseRequest {
    if (this.isCompleted()) {
      throw new Error("Cannot mark completed purchase request as failed")
    }

    return new PurchaseRequest({
      ...this.props,
      status: PurchaseRequestStatus.failed(),
      failureReason: reason,
      errorCode: errorCode || null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Schedule a retry attempt
   * Business Rule: Can only retry from failed status, must not exceed max retries
   */
  scheduleRetry(nextRetryAt: Date): PurchaseRequest {
    if (!this.canRetry()) {
      throw new Error(`Cannot schedule retry (status: ${this.status.value}, retries: ${this.retryCount}/${this.maxRetries})`)
    }

    return new PurchaseRequest({
      ...this.props,
      status: PurchaseRequestStatus.retryScheduled(),
      retryCount: this.props.retryCount + 1,
      nextRetryAt,
      updatedAt: new Date(),
    })
  }

  /**
   * Mark that a new user was created during this purchase
   */
  markUserCreated(): PurchaseRequest {
    return new PurchaseRequest({
      ...this.props,
      userCreated: true,
      updatedAt: new Date(),
    })
  }

  /**
   * Set prorated amount for upgrade purchases
   */
  setProratedAmount(amount: number): PurchaseRequest {
    if (amount < 0) {
      throw new Error("Prorated amount cannot be negative")
    }

    return new PurchaseRequest({
      ...this.props,
      proratedAmount: amount,
      updatedAt: new Date(),
    })
  }

  /**
   * Convert to plain object for persistence
   */
  toObject(): PurchaseRequestProps {
    return { ...this.props }
  }

  protected validate(): void {
    super.validate()

    if (!this.props.requestUuid || this.props.requestUuid.trim() === "") {
      throw new Error("PurchaseRequest must have a requestUuid")
    }

    if (!this.props.email) {
      throw new Error("PurchaseRequest must have an email")
    }

    if (!this.props.productId || this.props.productId <= 0) {
      throw new Error("PurchaseRequest must have a valid productId")
    }

    if (!this.props.requestData) {
      throw new Error("PurchaseRequest must have requestData")
    }

    if (this.props.retryCount < 0) {
      throw new Error("Retry count cannot be negative")
    }

    if (this.props.retryCount > this.props.maxRetries) {
      throw new Error("Retry count cannot exceed max retries")
    }

    if (this.props.proratedAmount !== null && this.props.proratedAmount < 0) {
      throw new Error("Prorated amount cannot be negative")
    }
  }
}
