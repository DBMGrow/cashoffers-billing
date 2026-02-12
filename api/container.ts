/**
 * Dependency Injection Container
 * Wires up all services and repositories
 */
import { Kysely } from 'kysely'
import type { DB } from '@api/lib/db'
import { createConfig } from '@api/config/config.service'
import { createLogger } from '@api/infrastructure/logging/structured.logger'
import { DatabaseLogger } from '@api/infrastructure/logging/database.logger'
import { createKyselyDatabase } from '@api/infrastructure/database/kysely.factory'
import { KyselyTransactionManager } from '@api/infrastructure/database/transaction/kysely-transaction-manager'
import { createTransactionRepository } from '@api/infrastructure/database/repositories/transaction.repository'
import { createSubscriptionRepository } from '@api/infrastructure/database/repositories/subscription.repository'
import { createUserCardRepository } from '@api/infrastructure/database/repositories/user-card.repository'
import { createProductRepository } from '@api/infrastructure/database/repositories/product.repository'
import { createPurchaseRequestRepository } from '@api/infrastructure/database/repositories/purchase-request.repository'
import { createWhitelabelRepository } from '@api/infrastructure/database/repositories/whitelabel.repository'
import { createBillingLogRepository } from '@api/infrastructure/database/repositories/billing-log.repository'
import { createSquarePaymentProvider } from '@api/infrastructure/payment/square/square.provider'
import { createDualEnvironmentPaymentProvider } from '@api/infrastructure/payment/dual-environment-provider'
import { createSquareErrorTranslator } from '@api/infrastructure/payment/error/square-error-translator'
import { createMjmlCompiler } from '@api/infrastructure/email/mjml/mjml-compiler'
import { createSendGridEmailService } from '@api/infrastructure/email/sendgrid/sendgrid.service'
import { createUserApiClient } from '@api/infrastructure/external-api/user-api/user-api.client'
import { InMemoryEventBus } from '@api/infrastructure/events/in-memory-event-bus'
import { EmailNotificationHandler } from '@api/application/event-handlers/email-notification.handler'
import { TransactionLoggingHandler } from '@api/application/event-handlers/transaction-logging.handler'
import { LogFlushHandler } from '@api/application/event-handlers/log-flush.handler'
import { PremiumActivationHandler } from '@api/application/event-handlers/premium-activation.handler'
import { PremiumDeactivationHandler } from '@api/application/event-handlers/premium-deactivation.handler'
import { CreatePaymentUseCase } from '@api/use-cases/payment/create-payment.use-case'
import { RefundPaymentUseCase } from '@api/use-cases/payment/refund-payment.use-case'
import { CreateCardUseCase } from '@api/use-cases/payment/create-card.use-case'
import { GetPaymentsUseCase } from '@api/use-cases/payment/get-payments.use-case'
import { CreateSubscriptionUseCase } from '@api/use-cases/subscription/create-subscription.use-case'
import { RenewSubscriptionUseCase } from '@api/use-cases/subscription/renew-subscription.use-case'
import { PauseSubscriptionUseCase } from '@api/use-cases/subscription/pause-subscription.use-case'
import { ResumeSubscriptionUseCase } from '@api/use-cases/subscription/resume-subscription.use-case'
import { CancelOnRenewalUseCase } from '@api/use-cases/subscription/cancel-on-renewal.use-case'
import { MarkForDowngradeUseCase } from '@api/use-cases/subscription/mark-for-downgrade.use-case'
import { UpdateSubscriptionFieldsUseCase } from '@api/use-cases/subscription/update-subscription-fields.use-case'
import { GetSubscriptionsUseCase } from '@api/use-cases/subscription/get-subscriptions.use-case'
import { PurchaseSubscriptionUseCase } from '@api/use-cases/subscription/purchase-subscription.use-case'
import { CalculateProratedUseCase } from '@api/use-cases/subscription/calculate-prorated.use-case'
import { CreateProductUseCase } from '@api/use-cases/product/create-product.use-case'
import { GetUserCardUseCase } from '@api/use-cases/card/get-user-card.use-case'
import { CheckUserCardInfoUseCase } from '@api/use-cases/card/check-user-card-info.use-case'
import { DeactivateSubscriptionUseCase } from '@api/use-cases/subscription/deactivate-subscription.use-case'
import { UnlockPropertyUseCase } from '@api/use-cases/property/unlock-property.use-case'
import { createHealthMetricsService } from '@api/domain/services/health-metrics.service'
import { createHealthReportService } from '@api/domain/services/health-report.service'
import { createCriticalAlertService } from '@api/domain/services/critical-alert.service'
import type { IConfig, IConfigService } from '@api/config/config.interface'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { ITransactionManager } from '@api/infrastructure/database/transaction/transaction-manager.interface'
import type { IEventBus } from '@api/infrastructure/events/event-bus.interface'
import type { ITransactionRepository } from '@api/infrastructure/database/repositories/transaction.repository.interface'
import type { ISubscriptionRepository } from '@api/infrastructure/database/repositories/subscription.repository.interface'
import type { IUserCardRepository } from '@api/infrastructure/database/repositories/user-card.repository.interface'
import type { IProductRepository } from '@api/infrastructure/database/repositories/product.repository.interface'
import type { IPurchaseRequestRepository } from '@api/infrastructure/database/repositories/purchase-request.repository.interface'
import type { IWhitelabelRepository } from '@api/infrastructure/database/repositories/whitelabel.repository.interface'
import type { IBillingLogRepository } from '@api/infrastructure/database/repositories/billing-log.repository.interface'
import type { IPaymentProvider } from '@api/infrastructure/payment/payment-provider.interface'
import type { IPaymentErrorTranslator } from '@api/infrastructure/payment/error/payment-error-translator.interface'
import type { IMjmlCompiler } from '@api/infrastructure/email/mjml/mjml-compiler.interface'
import type { IEmailService } from '@api/infrastructure/email/email-service.interface'
import type { IUserApiClient } from '@api/infrastructure/external-api/user-api.interface'
import type { ICreatePaymentUseCase } from '@api/use-cases/payment/create-payment.use-case.interface'
import type { IRefundPaymentUseCase } from '@api/use-cases/payment/refund-payment.use-case.interface'
import type { ICreateCardUseCase } from '@api/use-cases/payment/create-card.use-case.interface'
import type { IGetPaymentsUseCase } from '@api/use-cases/payment/get-payments.use-case.interface'
import type { ICreateSubscriptionUseCase } from '@api/use-cases/subscription/create-subscription.use-case.interface'
import type { IRenewSubscriptionUseCase } from '@api/use-cases/subscription/renew-subscription.use-case.interface'
import type { IPauseSubscriptionUseCase } from '@api/use-cases/subscription/pause-subscription.use-case.interface'
import type { IResumeSubscriptionUseCase } from '@api/use-cases/subscription/resume-subscription.use-case.interface'
import type { ICancelOnRenewalUseCase } from '@api/use-cases/subscription/cancel-on-renewal.use-case.interface'
import type { IMarkForDowngradeUseCase } from '@api/use-cases/subscription/mark-for-downgrade.use-case.interface'
import type { IUpdateSubscriptionFieldsUseCase } from '@api/use-cases/subscription/update-subscription-fields.use-case.interface'
import type { IGetSubscriptionsUseCase } from '@api/use-cases/subscription/get-subscriptions.use-case.interface'
import type { IPurchaseSubscriptionUseCase } from '@api/use-cases/subscription/purchase-subscription.use-case.interface'
import type { ICalculateProratedUseCase } from '@api/use-cases/subscription/calculate-prorated.use-case.interface'
import type { ICreateProductUseCase } from '@api/use-cases/product/create-product.use-case.interface'
import type { IGetUserCardUseCase } from '@api/use-cases/card/get-user-card.use-case.interface'
import type { ICheckUserCardInfoUseCase } from '@api/use-cases/card/check-user-card-info.use-case.interface'
import type { IDeactivateSubscriptionUseCase } from '@api/use-cases/subscription/deactivate-subscription.use-case.interface'
import type { IUnlockPropertyUseCase } from '@api/use-cases/property/unlock-property.use-case.interface'
import type { IHealthMetricsService } from '@api/domain/services/health-metrics.service'
import type { IHealthReportService } from '@api/domain/services/health-report.service'
import type { ICriticalAlertService } from '@api/domain/services/critical-alert.service'

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
    purchaseRequest: IPurchaseRequestRepository
    whitelabel: IWhitelabelRepository
    billingLog: IBillingLogRepository
  }
  services: {
    payment: IPaymentProvider
    paymentErrorTranslator: IPaymentErrorTranslator
    mjmlCompiler: IMjmlCompiler
    email: IEmailService
    userApi: IUserApiClient
    eventBus: IEventBus
    healthMetrics: IHealthMetricsService
    healthReport: IHealthReportService
    criticalAlert: ICriticalAlertService
  }
  useCases: {
    // Payment use cases
    createPayment: ICreatePaymentUseCase
    refundPayment: IRefundPaymentUseCase
    createCard: ICreateCardUseCase
    getPayments: IGetPaymentsUseCase
    // Card use cases
    getUserCard: IGetUserCardUseCase
    checkUserCardInfo: ICheckUserCardInfoUseCase
    // Subscription use cases
    createSubscription: ICreateSubscriptionUseCase
    renewSubscription: IRenewSubscriptionUseCase
    pauseSubscription: IPauseSubscriptionUseCase
    resumeSubscription: IResumeSubscriptionUseCase
    cancelOnRenewal: ICancelOnRenewalUseCase
    markForDowngrade: IMarkForDowngradeUseCase
    updateSubscriptionFields: IUpdateSubscriptionFieldsUseCase
    getSubscriptions: IGetSubscriptionsUseCase
    purchaseSubscription: IPurchaseSubscriptionUseCase
    deactivateSubscription: IDeactivateSubscriptionUseCase
    calculateProrated: ICalculateProratedUseCase
    // Product use cases
    createProduct: ICreateProductUseCase
    // Property use cases
    unlockProperty: IUnlockPropertyUseCase
  }
}

/**
 * Create the application container
 */
export const createContainer = (): IContainer => {
  // Load configuration
  const config = createConfig()

  // Create base logger (console only)
  const baseLogger = createLogger(
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
    purchaseRequest: createPurchaseRequestRepository(db),
    whitelabel: createWhitelabelRepository(db),
    billingLog: createBillingLogRepository(db),
  }

  // Wrap base logger with DatabaseLogger for persistence
  const logger = new DatabaseLogger(
    baseLogger,
    repositories.billingLog,
    { service: 'cashoffers-billing' }
  )

  // Create transaction manager (with database logger)
  const transactionManager = new KyselyTransactionManager(db, logger)

  // Create services
  const mjmlCompiler = createMjmlCompiler(logger)

  // Create event bus
  const eventBus = new InMemoryEventBus(logger)

  // Create payment providers (production and sandbox)
  const productionPaymentProvider = createSquarePaymentProvider(
    config,
    logger,
    'production'
  )

  const sandboxPaymentProvider = config.square.sandbox.accessToken
    ? createSquarePaymentProvider(config, logger, 'sandbox')
    : null

  const paymentProvider = createDualEnvironmentPaymentProvider(
    productionPaymentProvider,
    sandboxPaymentProvider,
    logger
  )

  // Create monitoring services
  const healthMetricsService = createHealthMetricsService(
    repositories.transaction,
    repositories.subscription,
    repositories.billingLog
  )

  const emailService = createSendGridEmailService(config, logger, mjmlCompiler)

  const healthReportService = createHealthReportService(
    healthMetricsService,
    emailService,
    logger
  )

  const criticalAlertService = createCriticalAlertService(
    emailService,
    config,
    logger
  )

  const services = {
    payment: paymentProvider,
    paymentErrorTranslator: createSquareErrorTranslator(),
    mjmlCompiler,
    email: emailService,
    userApi: createUserApiClient(config, logger),
    eventBus,
    healthMetrics: healthMetricsService,
    healthReport: healthReportService,
    criticalAlert: criticalAlertService,
  }

  // Register event handlers
  const emailNotificationHandler = new EmailNotificationHandler(services.email, logger)
  const transactionLoggingHandler = new TransactionLoggingHandler(repositories.transaction, logger)
  const logFlushHandler = new LogFlushHandler(logger as DatabaseLogger, logger)
  const premiumActivationHandler = new PremiumActivationHandler(services.userApi, logger)
  const premiumDeactivationHandler = new PremiumDeactivationHandler(
    services.userApi,
    repositories.whitelabel,
    repositories.subscription,
    logger
  )

  // Subscribe handlers to events
  eventBus.subscribe('SubscriptionCreated', emailNotificationHandler)
  eventBus.subscribe('SubscriptionRenewed', emailNotificationHandler)
  eventBus.subscribe('PaymentFailed', emailNotificationHandler)
  eventBus.subscribe('SubscriptionDeactivated', emailNotificationHandler)
  eventBus.subscribe('SubscriptionPaused', emailNotificationHandler)
  eventBus.subscribe('SubscriptionCancelled', emailNotificationHandler)
  eventBus.subscribe('SubscriptionDowngraded', emailNotificationHandler)

  eventBus.subscribe('PaymentProcessed', transactionLoggingHandler)
  eventBus.subscribe('PaymentFailed', transactionLoggingHandler)

  eventBus.subscribe('RequestCompleted', logFlushHandler)

  eventBus.subscribe('SubscriptionCreated', premiumActivationHandler)
  eventBus.subscribe('SubscriptionRenewed', premiumActivationHandler)

  eventBus.subscribe('SubscriptionDeactivated', premiumDeactivationHandler)
  eventBus.subscribe('SubscriptionPaused', premiumDeactivationHandler)

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
    // Payment use cases
    createPayment: new CreatePaymentUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      userCardRepository: repositories.userCard,
      transactionRepository: repositories.transaction,
      config: configService,
      eventBus: services.eventBus,
    }),
    refundPayment: new RefundPaymentUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      transactionRepository: repositories.transaction,
      userApiClient: services.userApi,
      config: configService,
      eventBus: services.eventBus,
    }),
    createCard: new CreateCardUseCase({
      logger,
      paymentProvider: services.payment,
      userCardRepository: repositories.userCard,
      transactionRepository: repositories.transaction,
      subscriptionRepository: repositories.subscription,
      emailService: services.email,
      eventBus: services.eventBus,
    }),
    getPayments: new GetPaymentsUseCase({
      logger,
      transactionRepository: repositories.transaction,
    }),
    // Card use cases
    getUserCard: new GetUserCardUseCase({
      logger,
      userCardRepository: repositories.userCard,
    }),
    checkUserCardInfo: new CheckUserCardInfoUseCase({
      logger,
      userCardRepository: repositories.userCard,
    }),
    // Subscription use cases
    createSubscription: new CreateSubscriptionUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      userApiClient: services.userApi,
      subscriptionRepository: repositories.subscription,
      productRepository: repositories.product,
      transactionRepository: repositories.transaction,
      userCardRepository: repositories.userCard,
      eventBus: services.eventBus,
    }),
    renewSubscription: new RenewSubscriptionUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      subscriptionRepository: repositories.subscription,
      transactionRepository: repositories.transaction,
      userCardRepository: repositories.userCard,
      purchaseRequestRepository: repositories.purchaseRequest,
      config: configService,
      transactionManager,
      eventBus: services.eventBus,
    }),
    pauseSubscription: new PauseSubscriptionUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      transactionRepository: repositories.transaction,
      emailService: services.email,
      userApiClient: services.userApi,
      eventBus: services.eventBus,
    }),
    resumeSubscription: new ResumeSubscriptionUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      transactionRepository: repositories.transaction,
    }),
    cancelOnRenewal: new CancelOnRenewalUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      emailService: services.email,
      userApiClient: services.userApi,
      eventBus: services.eventBus,
    }),
    markForDowngrade: new MarkForDowngradeUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      emailService: services.email,
      userApiClient: services.userApi,
      eventBus: services.eventBus,
    }),
    updateSubscriptionFields: new UpdateSubscriptionFieldsUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      transactionRepository: repositories.transaction,
    }),
    getSubscriptions: new GetSubscriptionsUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
    }),
    purchaseSubscription: new PurchaseSubscriptionUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      userApiClient: services.userApi,
      productRepository: repositories.product,
      subscriptionRepository: repositories.subscription,
      userCardRepository: repositories.userCard,
      transactionRepository: repositories.transaction,
      purchaseRequestRepository: repositories.purchaseRequest,
      eventBus: services.eventBus,
    }),
    deactivateSubscription: new DeactivateSubscriptionUseCase({
      logger,
      subscriptionRepository: repositories.subscription,
      userApiClient: services.userApi,
      eventBus: services.eventBus,
    }),
    calculateProrated: new CalculateProratedUseCase({
      logger,
      productRepository: repositories.product,
      subscriptionRepository: repositories.subscription,
    }),
    createProduct: new CreateProductUseCase({
      logger,
      productRepository: repositories.product,
    }),
    // Property use cases
    unlockProperty: new UnlockPropertyUseCase({
      logger,
      paymentProvider: services.payment,
      emailService: services.email,
      transactionRepository: repositories.transaction,
      productRepository: repositories.product,
      config: configService,
      eventBus: services.eventBus,
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
