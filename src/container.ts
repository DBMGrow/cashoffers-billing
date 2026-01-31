/**
 * Dependency Injection Container
 * Wires up all services and repositories
 */
import { Kysely } from 'kysely'
import type { DB } from '@/lib/db'
import { createConfig } from '@/config/config.service'
import { createLogger } from '@/infrastructure/logging/structured.logger'
import { createKyselyDatabase } from '@/infrastructure/database/kysely.factory'
import { createTransactionRepository } from '@/infrastructure/database/repositories/transaction.repository'
import { createSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository'
import { createUserCardRepository } from '@/infrastructure/database/repositories/user-card.repository'
import { createProductRepository } from '@/infrastructure/database/repositories/product.repository'
import { createSquarePaymentProvider } from '@/infrastructure/payment/square/square.provider'
import { createSendGridEmailService } from '@/infrastructure/email/sendgrid/sendgrid.service'
import { createUserApiClient } from '@/infrastructure/external-api/user-api/user-api.client'
import type { IConfig } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { ITransactionRepository } from '@/infrastructure/database/repositories/transaction.repository.interface'
import type { ISubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository.interface'
import type { IUserCardRepository } from '@/infrastructure/database/repositories/user-card.repository.interface'
import type { IProductRepository } from '@/infrastructure/database/repositories/product.repository.interface'
import type { IPaymentProvider } from '@/infrastructure/payment/payment-provider.interface'
import type { IEmailService } from '@/infrastructure/email/email-service.interface'
import type { IUserApiClient } from '@/infrastructure/external-api/user-api.interface'

/**
 * Application container
 * Holds all dependencies
 */
export interface IContainer {
  config: IConfig
  logger: ILogger
  db: Kysely<DB>
  repositories: {
    transaction: ITransactionRepository
    subscription: ISubscriptionRepository
    userCard: IUserCardRepository
    product: IProductRepository
  }
  services: {
    payment: IPaymentProvider
    email: IEmailService
    userApi: IUserApiClient
  }
  // TODO: Add use cases as we build them (Phase 4)
}

/**
 * Create the application container
 */
export const createContainer = (): IContainer => {
  // Load configuration
  const config = createConfig()

  // Create logger
  const logger = createLogger(
    { service: 'cashoffers-billing' },
    config.nodeEnv === 'production' ? 'info' : 'debug'
  )

  // Create database connection
  const db = createKyselyDatabase(config)

  // Create repositories
  const repositories = {
    transaction: createTransactionRepository(db),
    subscription: createSubscriptionRepository(db),
    userCard: createUserCardRepository(db),
    product: createProductRepository(db),
  }

  // Create services
  const services = {
    payment: createSquarePaymentProvider(config, logger),
    email: createSendGridEmailService(config, logger),
    userApi: createUserApiClient(config, logger),
  }

  logger.info('Application container initialized', {
    environment: config.nodeEnv,
    port: config.port,
    servicesInitialized: Object.keys(services).length,
  })

  return {
    config,
    logger,
    db,
    repositories,
    services,
  }
}

/**
 * Global container instance (for backwards compatibility during migration)
 */
let container: IContainer | null = null

/**
 * Get or create the global container
 */
export const getContainer = (): IContainer => {
  if (!container) {
    container = createContainer()
  }
  return container
}

/**
 * Reset the container (useful for testing)
 */
export const resetContainer = (): void => {
  container = null
}
