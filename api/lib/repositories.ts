import { db } from '@api/lib/database'
import { createTransactionRepository } from '@api/infrastructure/database/repositories/transaction.repository'
import { createSubscriptionRepository } from '@api/infrastructure/database/repositories/subscription.repository'
import { createUserCardRepository } from '@api/infrastructure/database/repositories/user-card.repository'
import { createProductRepository } from '@api/infrastructure/database/repositories/product.repository'
import { createPurchaseRequestRepository } from '@api/infrastructure/database/repositories/purchase-request.repository'
import { createWhitelabelRepository } from '@api/infrastructure/database/repositories/whitelabel.repository'
import { createBillingLogRepository } from '@api/infrastructure/database/repositories/billing-log.repository'

export const transactionRepository = createTransactionRepository(db)
export const subscriptionRepository = createSubscriptionRepository(db)
export const userCardRepository = createUserCardRepository(db)
export const productRepository = createProductRepository(db)
export const purchaseRequestRepository = createPurchaseRequestRepository(db)
export const whitelabelRepository = createWhitelabelRepository(db)
export const billingLogRepository = createBillingLogRepository(db)

export type TransactionRepository = typeof transactionRepository
export type SubscriptionRepository = typeof subscriptionRepository
export type UserCardRepository = typeof userCardRepository
export type ProductRepository = typeof productRepository
export type PurchaseRequestRepository = typeof purchaseRequestRepository
export type WhitelabelRepository = typeof whitelabelRepository
export type BillingLogRepository = typeof billingLogRepository
