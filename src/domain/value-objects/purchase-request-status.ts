import { ValueObject } from "../base/value-object.interface"

/**
 * PurchaseRequest Status Value Object
 * Represents the state of a purchase request through its lifecycle
 */
export enum PurchaseRequestStatusType {
  PENDING = "PENDING",
  VALIDATING = "VALIDATING",
  PROCESSING_PAYMENT = "PROCESSING_PAYMENT",
  CREATING_SUBSCRIPTION = "CREATING_SUBSCRIPTION",
  FINALIZING = "FINALIZING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  RETRY_SCHEDULED = "RETRY_SCHEDULED",
}

export class PurchaseRequestStatus extends ValueObject<PurchaseRequestStatusType> {
  private constructor(value: PurchaseRequestStatusType) {
    super(value)
  }

  static pending(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.PENDING)
  }

  static validating(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.VALIDATING)
  }

  static processingPayment(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.PROCESSING_PAYMENT)
  }

  static creatingSubscription(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.CREATING_SUBSCRIPTION)
  }

  static finalizing(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.FINALIZING)
  }

  static completed(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.COMPLETED)
  }

  static failed(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.FAILED)
  }

  static retryScheduled(): PurchaseRequestStatus {
    return new PurchaseRequestStatus(PurchaseRequestStatusType.RETRY_SCHEDULED)
  }

  static fromString(status: string): PurchaseRequestStatus {
    const upperStatus = status.toUpperCase()
    if (!Object.values(PurchaseRequestStatusType).includes(upperStatus as PurchaseRequestStatusType)) {
      throw new Error(`Invalid purchase request status: ${status}`)
    }
    return new PurchaseRequestStatus(upperStatus as PurchaseRequestStatusType)
  }

  // Predicates
  isPending(): boolean {
    return this.value === PurchaseRequestStatusType.PENDING
  }

  isValidating(): boolean {
    return this.value === PurchaseRequestStatusType.VALIDATING
  }

  isProcessingPayment(): boolean {
    return this.value === PurchaseRequestStatusType.PROCESSING_PAYMENT
  }

  isCreatingSubscription(): boolean {
    return this.value === PurchaseRequestStatusType.CREATING_SUBSCRIPTION
  }

  isFinalizing(): boolean {
    return this.value === PurchaseRequestStatusType.FINALIZING
  }

  isCompleted(): boolean {
    return this.value === PurchaseRequestStatusType.COMPLETED
  }

  isFailed(): boolean {
    return this.value === PurchaseRequestStatusType.FAILED
  }

  isRetryScheduled(): boolean {
    return this.value === PurchaseRequestStatusType.RETRY_SCHEDULED
  }

  isInProgress(): boolean {
    return [
      PurchaseRequestStatusType.VALIDATING,
      PurchaseRequestStatusType.PROCESSING_PAYMENT,
      PurchaseRequestStatusType.CREATING_SUBSCRIPTION,
      PurchaseRequestStatusType.FINALIZING,
    ].includes(this.value)
  }

  isTerminal(): boolean {
    return this.isCompleted() || this.isFailed()
  }

  canRetry(): boolean {
    return this.isFailed()
  }

  canTransitionTo(newStatus: PurchaseRequestStatus): boolean {
    // Define valid status transitions
    const validTransitions: Record<PurchaseRequestStatusType, PurchaseRequestStatusType[]> = {
      [PurchaseRequestStatusType.PENDING]: [
        PurchaseRequestStatusType.VALIDATING,
        PurchaseRequestStatusType.FAILED,
      ],
      [PurchaseRequestStatusType.VALIDATING]: [
        PurchaseRequestStatusType.PROCESSING_PAYMENT,
        PurchaseRequestStatusType.FAILED,
      ],
      [PurchaseRequestStatusType.PROCESSING_PAYMENT]: [
        PurchaseRequestStatusType.CREATING_SUBSCRIPTION,
        PurchaseRequestStatusType.FAILED,
        PurchaseRequestStatusType.RETRY_SCHEDULED,
      ],
      [PurchaseRequestStatusType.CREATING_SUBSCRIPTION]: [
        PurchaseRequestStatusType.FINALIZING,
        PurchaseRequestStatusType.FAILED,
      ],
      [PurchaseRequestStatusType.FINALIZING]: [
        PurchaseRequestStatusType.COMPLETED,
        PurchaseRequestStatusType.FAILED,
      ],
      [PurchaseRequestStatusType.COMPLETED]: [], // Terminal state
      [PurchaseRequestStatusType.FAILED]: [
        PurchaseRequestStatusType.RETRY_SCHEDULED,
      ],
      [PurchaseRequestStatusType.RETRY_SCHEDULED]: [
        PurchaseRequestStatusType.VALIDATING,
        PurchaseRequestStatusType.FAILED,
      ],
    }

    return validTransitions[this.value]?.includes(newStatus.value) ?? false
  }

  protected validate(): void {
    if (!Object.values(PurchaseRequestStatusType).includes(this.value)) {
      throw new Error(`Invalid purchase request status: ${this.value}`)
    }
  }
}
