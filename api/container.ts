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
import { createPurchaseRequestRepository } from '@/infrastructure/database/repositories/purchase-request.repository'
import { createSquarePaymentProvider } from '@/infrastructure/payment/square/square.provider'
import { createDualEnvironmentPaymentProvider } from '@/infrastructure/payment/dual-environment-provider'
import { createSquareErrorTranslator } from '@/infrastructure/payment/error/square-error-translator'
import { createMjmlCompiler } from '@/infrastructure/email/mjml/mjml-compiler'
import { createSendGridEmailService } from '@/infrastructure/email/sendgrid/sendgrid.service'
import { createUserApiClient } from '@/infrastructure/external-api/user-api/user-api.client'
import { InMemoryEventBus } from '@/infrastructure/events/in-memory-event-bus'
import { EmailNotificationHandler } from '@/application/event-handlers/email-notification.handler'
import { TransactionLoggingHandler } from '@/application/event-handlers/transaction-logging.handler'
import { PremiumActivationHandler } from '@/application/event-handlers/premium-activation.handler'
import { PremiumDeactivationHandler } from '@/application/event-handlers/premium-deactivation.handler'
import { CreatePaymentUseCase } from '@/use-cases/payment/create-payment.use-case'
import { RefundPaymentUseCase } from '@/use-cases/payment/refund-payment.use-case'
import { CreateCardUseCase } from '@/use-cases/payment/create-card.use-case'
import { GetPaymentsUseCase } from '@/use-cases/payment/get-payments.use-case'
import { CreateSubscriptionUseCase } from '@/use-cases/subscription/create-subscription.use-case'
import { RenewSubscriptionUseCase } from '@/use-cases/subscription/renew-subscription.use-case'
import { PauseSubscriptionUseCase } from '@/use-cases/subscription/pause-subscription.use-case'
import { ResumeSubscriptionUseCase } from '@/use-cases/subscription/resume-subscription.use-case'
import { CancelOnRenewalUseCase } from '@/use-cases/subscription/cancel-on-renewal.use-case'
import { MarkForDowngradeUseCase } from '@/use-cases/subscription/mark-for-downgrade.use-case'
import { UpdateSubscriptionFieldsUseCase } from '@/use-cases/subscription/update-subscription-fields.use-case'
import { GetSubscriptionsUseCase } from '@/use-cases/subscription/get-subscriptions.use-case'
import { PurchaseSubscriptionUseCase } from '@/use-cases/subscription/purchase-subscription.use-case'
import { CreateProductUseCase } from '@/use-cases/product/create-product.use-case'
import { GetUserCardUseCase } from '@/use-cases/card/get-user-card.use-case'
import { CheckUserCardInfoUseCase } from '@/use-cases/card/check-user-card-info.use-case'
import { DeactivateSubscriptionUseCase } from '@/use-cases/subscription/deactivate-subscription.use-case'
import { UnlockPropertyUseCase } from '@/use-cases/property/unlock-property.use-case'
import type { IConfig, IConfigService } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type { ITransactionManager } from '@/infrastructure/database/transaction/transaction-manager.interface'
import type { IEventBus } from '@/infrastructure/events/event-bus.interface'
import type { ITransactionRepository } from '@/infrastructure/database/repositories/transaction.repository.interface'
import type { ISubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository.interface'
import type { IUserCardRepository } from '@/infrastructure/database/repositories/user-card.repository.interface'
import type { IProductRepository } from '@/infrastructure/database/repositories/product.repository.interface'
import type { IPurchaseRequestRepository } from '@/infrastructure/database/repositories/purchase-request.repository.interface'
import type { IPaymentProvider } from '@/infrastructure/payment/payment-provider.interface'
import type { IPaymentErrorTranslator } from '@/infrastructure/payment/error/payment-error-translator.interface'
import type { IMjmlCompiler } from '@/infrastructure/email/mjml/mjml-compiler.interface'
import type { IEmailService } from '@/infrastructure/email/email-service.interface'
import type { IUserApiClient } from '@/infrastructure/external-api/user-api.interface'
import type { ICreatePaymentUseCase } from '@/use-cases/payment/create-payment.use-case.interface'
import type { IRefundPaymentUseCase } from '@/use-cases/payment/refund-payment.use-case.interface'
import type { ICreateCardUseCase } from '@/use-cases/payment/create-card.use-case.interface'
import type { IGetPaymentsUseCase } from '@/use-cases/payment/get-payments.use-case.interface'
import type { ICreateSubscriptionUseCase } from '@/use-cases/subscription/create-subscription.use-case.interface'
import type { IRenewSubscriptionUseCase } from '@/use-cases/subscription/renew-subscription.use-case.interface'
import type { IPauseSubscriptionUseCase } from '@/use-cases/subscription/pause-subscription.use-case.interface'
import type { IResumeSubscriptionUseCase } from '@/use-cases/subscription/resume-subscription.use-case.interface'
import type { ICancelOnRenewalUseCase } from '@/use-cases/subscription/cancel-on-renewal.use-case.interface'
import type { IMarkForDowngradeUseCase } from '@/use-cases/subscription/mark-for-downgrade.use-case.interface'
import type { IUpdateSubscriptionFieldsUseCase } from '@/use-cases/subscription/update-subscription-fields.use-case.interface'
import type { IGetSubscriptionsUseCase } from '@/use-cases/subscription/get-subscriptions.use-case.interface'
import type { IPurchaseSubscriptionUseCase } from '@/use-cases/subscription/purchase-subscription.use-case.interface'
import type { ICreateProductUseCase } from '@/use-cases/product/create-product.use-case.interface'
import type { IGetUserCardUseCase } from '@/use-cases/card/get-user-card.use-case.interface'
import type { ICheckUserCardInfoUseCase } from '@/use-cases/card/check-user-card-info.use-case.interface'
import type { IDeactivateSubscriptionUseCase } from '@/use-cases/subscription/deactivate-subscription.use-case.interface'
import type { IUnlockPropertyUseCase } from '@/use-cases/property/unlock-property.use-case.interface'

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
  }
  services: {
    payment: IPaymentProvider
    paymentErrorTranslator: IPaymentErrorTranslator
    mjmlCompiler: IMjmlCompiler
    email: IEmailService
    userApi: IUserApiClient
    eventBus: IEventBus
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
    purchaseRequest: createPurchaseRequestRepository(db),
  }

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

  const services = {
    payment: paymentProvider,
    paymentErrorTranslator: createSquareErrorTranslator(),
    mjmlCompiler,
    email: createSendGridEmailService(config, logger, mjmlCompiler),
    userApi: createUserApiClient(config, logger),
    eventBus,
  }

  // Register event handlers
  const emailNotificationHandler = new EmailNotificationHandler(services.email, logger)
  const transactionLoggingHandler = new TransactionLoggingHandler(repositories.transaction, logger)
  const premiumActivationHandler = new PremiumActivationHandler(services.userApi, logger)
  const premiumDeactivationHandler = new PremiumDeactivationHandler(services.userApi, logger)

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
