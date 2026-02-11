import {
  PurchaseRequest,
  PurchaseRequestProps,
  PurchaseRequestType,
  PurchaseRequestSource,
  PurchaseRequestResults,
} from "../entities/purchase-request"
import { PurchaseRequestStatus } from "../value-objects/purchase-request-status"
import { Email } from "../value-objects/email"

/**
 * Database representation of a purchase request (from repository)
 * This matches the PurchaseRequests table schema
 */
export interface PurchaseRequestDbModel {
  request_id: number
  request_uuid: string
  request_type: string
  source: string

  // Core identifiers
  user_id: number | null
  email: string
  product_id: number
  subscription_id: number | null

  // Input data
  request_data: string | object // JSON field

  // Status tracking
  status: string

  // Error tracking
  failure_reason: string | null
  error_code: string | null
  retry_count: number
  max_retries: number
  next_retry_at: Date | null

  // Results
  subscription_id_result: number | null
  transaction_id_result: number | null
  amount_charged: number | null
  card_id_result: string | null

  // Metadata
  idempotency_key: string | null
  user_created: boolean | number // MySQL stores boolean as tinyint
  prorated_amount: number | null

  // Audit timestamps
  createdAt: Date
  updatedAt: Date
  started_at: Date | null
  completed_at: Date | null
  processing_duration_ms: number | null
}

/**
 * Maps database purchase request model to domain entity
 */
export function toDomain(dbModel: PurchaseRequestDbModel): PurchaseRequest {
  // Parse request_data if it's a string (from JSON column)
  let requestData: Record<string, unknown>
  if (typeof dbModel.request_data === "string") {
    try {
      requestData = JSON.parse(dbModel.request_data)
    } catch {
      requestData = {}
    }
  } else {
    requestData = dbModel.request_data as Record<string, unknown>
  }

  const results: PurchaseRequestResults = {
    subscriptionId: dbModel.subscription_id_result,
    transactionId: dbModel.transaction_id_result,
    amountCharged: dbModel.amount_charged,
    cardId: dbModel.card_id_result,
  }

  const props: PurchaseRequestProps = {
    id: dbModel.request_id,
    requestUuid: dbModel.request_uuid,
    requestType: dbModel.request_type as PurchaseRequestType,
    source: dbModel.source as PurchaseRequestSource,
    userId: dbModel.user_id,
    email: Email.from(dbModel.email),
    productId: dbModel.product_id,
    subscriptionId: dbModel.subscription_id,
    requestData,
    status: PurchaseRequestStatus.fromString(dbModel.status),
    failureReason: dbModel.failure_reason,
    errorCode: dbModel.error_code,
    retryCount: dbModel.retry_count,
    maxRetries: dbModel.max_retries,
    nextRetryAt: dbModel.next_retry_at,
    results,
    idempotencyKey: dbModel.idempotency_key,
    userCreated: Boolean(dbModel.user_created),
    proratedAmount: dbModel.prorated_amount,
    startedAt: dbModel.started_at,
    completedAt: dbModel.completed_at,
    processingDurationMs: dbModel.processing_duration_ms,
    createdAt: dbModel.createdAt,
    updatedAt: dbModel.updatedAt,
  }

  return PurchaseRequest.from(props)
}

/**
 * Maps domain entity to database model for persistence
 */
export function toDatabase(entity: PurchaseRequest): Partial<PurchaseRequestDbModel> {
  const props = entity.toObject()

  return {
    request_id: props.id,
    request_uuid: props.requestUuid,
    request_type: props.requestType,
    source: props.source,
    user_id: props.userId,
    email: props.email.value,
    product_id: props.productId,
    subscription_id: props.subscriptionId,
    request_data: JSON.stringify(props.requestData),
    status: props.status.value,
    failure_reason: props.failureReason,
    error_code: props.errorCode,
    retry_count: props.retryCount,
    max_retries: props.maxRetries,
    next_retry_at: props.nextRetryAt,
    subscription_id_result: props.results.subscriptionId,
    transaction_id_result: props.results.transactionId,
    amount_charged: props.results.amountCharged,
    card_id_result: props.results.cardId,
    idempotency_key: props.idempotencyKey,
    user_created: props.userCreated ? 1 : 0,
    prorated_amount: props.proratedAmount,
    started_at: props.startedAt,
    completed_at: props.completedAt,
    processing_duration_ms: props.processingDurationMs,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  }
}
