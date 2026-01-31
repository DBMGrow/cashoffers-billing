/**
 * Dependency Injection Container
 * Wires up all services and repositories
 */
import { Kysely } from 'kysely'
import type { DB } from '@/lib/db'
import { createConfig } from '@/config/config.service'
import { createLogger } from '@/infrastructure/logging/structured.logger'
import { createKyselyDatabase } from '@/infrastructure/database/kysely.factory'
import { KyselyTransactionManager } from '@/infrastructure/database/transaction/kysely-transaction-manager'
import { createTransactionRepository } from '@/infrastructure/database/repositories/transaction.repository'
import { createSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository'
import { createUserCardRepository } from '@/infrastructure/database/repositories/user-card.repository'
import { createProductRepository } from '@/infrastructure/database/repositories/product.repository'
import { createSquarePaymentProvider } from '@/infrastructure/payment/square/square.provider'
import { createSquareErrorTranslator } from '@/infrastructure/payment/error/square-error-translator'
import { createMjmlCompiler } from '@/infrastructure/email/mjml/mjml-compiler'
import { createSendGridEmailService } from '@/infrastructure/email/sendgrid/sendgrid.service'
import { createUserApiClient } from '@/infrastructure/external-api/user-api/user-api.client'
import { CreatePaymentUseCase } from '@/use-cases/payment/create-payment.use-case'
import { CreateSubscriptionUseCase } from '@/use-cases/subscription/create-subscription.use-case'
import { RenewSubscriptionUseCase } from '@/use-cases/subscription/renew-subscription.use-case'
import type { IConfig, IConfigService } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { ITransactionManager } from '@/infrastructure/database/transaction/transaction-manager.interface'
import type { ITransactionRepository } from '@/infrastructure/database/repositories/transaction.repository.interface'
import type { ISubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository.interface'
import type { IUserCardRepository } from '@/infrastructure/database/repositories/user-card.repository.interface'
import type { IProductRepository } from '@/infrastructure/database/repositories/product.repository.interface'
import type { IPaymentProvider } from '@/infrastructure/payment/payment-provider.interface'
import type { IPaymentErrorTranslator } from '@/infrastructure/payment/error/payment-error-translator.interface'
import type { IMjmlCompiler } from '@/infrastructure/email/mjml/mjml-compiler.interface'
import type { IEmailService } from '@/infrastructure/email/email-service.interface'
import type { IUserApiClient } from '@/infrastructure/external-api/user-api.interface'
import type { ICreatePaymentUseCase } from '@/use-cases/payment/create-payment.use-case.interface'
import type { ICreateSubscriptionUseCase } from '@/use-cases/subscription/create-subscription.use-case.interface'
import type { IRenewSubscriptionUseCase } from '@/use-cases/subscription/renew-subscription.use-case.interface'

/**
 * Application container
 * Holds all dependencies
 */
export interface IContainer {
  config: IConfig
  logger: ILogger
  db: Kysely<DB>
  transactionManager: ITransactionManager
  repositories: {
    transaction: ITransactionRepository
    subscription: ISubscriptionRepository
    userCard: IUserCardRepository
    product: IProductRepository
  }
  services: {
    payment: IPaymentProvider
    paymentErrorTranslator: IPaymentErrorTranslator
    mjmlCompiler: IMjmlCompiler
    email: IEmailService
    userApi: IUserApiClient
  }
  useCases: {
    createPayment: ICreatePaymentUseCase
    createSubscription: ICreateSubscriptionUseCase
    renewSubscription: IRenewSubscriptionUseCase
  }
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

  // Create transaction manager
  const transactionManager = new KyselyTransactionManager(db, logger)

  // Create repositories
  const repositories = {
    transaction: createTransactionRepository(db),
    subscription: createSubscriptionRepository(db),
    userCard: createUserCardRepository(db),
    product: createProductRepository(db),
  }

  // Create services
  const mjmlCompiler = createMjmlCompiler(logger)

  const services = {
    payment: createSquarePaymentProvider(config, logger),
    paymentErrorTranslator: createSquareErrorTranslator(),
    mjmlCompiler,
    email: createSendGridEmailService(config, logger, mjmlCompiler),
    userApi: createUserApiClient(config, logger),
  }

  // Create config service wrapper for use cases
  const configService: IConfigService = {
    get: (key: string) => {
      const value = (config as any)[key]
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value || '')
    },
    getOrThrow: (key: string) => {
      const value = (config as any)[key]
      if (!value) throw new Error(`Config key ${key} not found`)
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    },
    getAll: () => config as any,
  }

  // Create use cases
  const useCases = {
    createPayment: new CreatePaymentUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      userCardRepository: repositories.userCard,
      transactionRepository: repositories.transaction,
      config: configService,
    }),
    createSubscription: new CreateSubscriptionUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      userApiClient: services.userApi,
      subscriptionRepository: repositories.subscription,
      productRepository: repositories.product,
      transactionRepository: repositories.transaction,
      userCardRepository: repositories.userCard,
    }),
    renewSubscription: new RenewSubscriptionUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      subscriptionRepository: repositories.subscription,
      transactionRepository: repositories.transaction,
      userCardRepository: repositories.userCard,
      config: configService,
      transactionManager,
    }),
  }

  logger.info('Application container initialized', {
    environment: config.nodeEnv,
    port: config.port,
    servicesInitialized: Object.keys(services).length,
    useCasesInitialized: Object.keys(useCases).length,
  })

  return {
    config,
    logger,
    db,
    transactionManager,
    repositories,
    services,
    useCases,
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
