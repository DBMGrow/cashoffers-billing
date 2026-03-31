import { Subscription, SubscriptionProps } from "../entities/subscription"
import { Money } from "../value-objects/money"
import { SubscriptionStatus } from "../value-objects/subscription-status"
import { Duration } from "../value-objects/duration"

/**
 * Database representation of a subscription (from repository)
 */
export interface SubscriptionDbModel {
  subscription_id: number
  user_id: number
  subscription_name: string
  product_id: number
  amount: number
  duration: string
  renewal_date: Date
  next_renewal_attempt?: Date | null
  payment_failure_count?: number | null
  status?: string | null
  data?: string | null
  cancel_on_renewal?: boolean | null
  downgrade_on_renewal?: boolean | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Maps database subscription model to domain entity
 */
export function toDomain(dbModel: SubscriptionDbModel): Subscription {
  const props: SubscriptionProps = {
    id: dbModel.subscription_id,
    userId: dbModel.user_id,
    subscriptionName: dbModel.subscription_name,
    productId: dbModel.product_id,
    amount: Money.fromCents(dbModel.amount || 0),
    duration: Duration.fromString(dbModel.duration || "monthly"),
    renewalDate: new Date(dbModel.renewal_date),
    nextRenewalAttempt: dbModel.next_renewal_attempt ? new Date(dbModel.next_renewal_attempt) : null,
    paymentFailureCount: dbModel.payment_failure_count ?? 0,
    status: dbModel.status ? SubscriptionStatus.fromString(dbModel.status) : SubscriptionStatus.active(),
    data: dbModel.data || null,
    cancelOnRenewal: dbModel.cancel_on_renewal ?? false,
    downgradeOnRenewal: dbModel.downgrade_on_renewal ?? false,
    createdAt: dbModel.createdAt || new Date(),
    updatedAt: dbModel.updatedAt || new Date(),
  }

  return Subscription.from(props)
}

/**
 * Maps domain entity to database model for persistence
 */
export function toDatabase(entity: Subscription): Partial<SubscriptionDbModel> {
  const props = entity.toObject()

  return {
    subscription_id: props.id,
    user_id: props.userId,
    subscription_name: props.subscriptionName,
    product_id: props.productId,
    amount: props.amount.cents,
    duration: props.duration.value,
    renewal_date: props.renewalDate,
    next_renewal_attempt: props.nextRenewalAttempt,
    payment_failure_count: props.paymentFailureCount,
    status: props.status.value,
    data: props.data,
    cancel_on_renewal: props.cancelOnRenewal,
    downgrade_on_renewal: props.downgradeOnRenewal,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  }
}
