import { db } from "@api/lib/database"
import {
  billingLogRepository,
  transactionRepository,
  subscriptionRepository,
  productRepository,
  whitelabelRepository,
} from "@api/lib/repositories"
import { config } from "@api/config/config.service"
import type { IConfigService } from "@api/config/config.interface"
import { createLogger } from "@api/infrastructure/logging/structured.logger"
import { createConsoleLogger } from "@api/infrastructure/logging/console.logger"
import { DatabaseLogger } from "@api/infrastructure/logging/database.logger"
import { KyselyTransactionManager } from "@api/infrastructure/database/transaction/kysely-transaction-manager"
import { createSquarePaymentProvider } from "@api/infrastructure/payment/square/square.provider"
import { createDualEnvironmentPaymentProvider } from "@api/infrastructure/payment/dual-environment-provider"
import { createSquareErrorTranslator } from "@api/infrastructure/payment/error/square-error-translator"
import { createSendGridEmailService } from "@api/infrastructure/email/sendgrid/sendgrid.service"
import { createSmtpEmailService } from "@api/infrastructure/email/smtp/smtp.service"
import { createUserApiClient } from "@api/infrastructure/external-api/user-api/user-api.client"
import { InMemoryEventBus } from "@api/infrastructure/events/in-memory-event-bus"
import { EmailNotificationHandler } from "@api/application/event-handlers/email-notification.handler"
import { TransactionLoggingHandler } from "@api/application/event-handlers/transaction-logging.handler"
import { LogFlushHandler } from "@api/application/event-handlers/log-flush.handler"
import { CashOffersAccountHandler } from "@api/application/service-handlers/cashoffers/cashoffers-account.handler"
import { HomeUptickAccountHandler } from "@api/application/service-handlers/homeuptick/homeuptick-account.handler"
import { AdminAlertHandler } from "@api/application/event-handlers/admin-alert.handler"
import { createHomeUptickApiClient } from "@api/infrastructure/external-api/homeuptick-api/homeuptick-api.client"
import { createHealthMetricsService } from "@api/domain/services/health-metrics.service"
import { createHealthReportService } from "@api/domain/services/health-report.service"
import { createCriticalAlertService } from "@api/domain/services/critical-alert.service"
import { createWhitelabelResolverService } from "@api/domain/services/whitelabel-resolver.service"

// Base logger (console only — no DB dependency)
// Use human-readable ConsoleLogger in dev, structured JSON in production
const baseLogger =
  config.nodeEnv === "production"
    ? createLogger({ service: "cashoffers-billing" }, "info")
    : createConsoleLogger({ service: "cashoffers-billing" })

// Logger wrapped with DB persistence
export const logger = new DatabaseLogger(baseLogger, billingLogRepository, { service: "cashoffers-billing" })

export const transactionManager = new KyselyTransactionManager(db, logger)

export const eventBus = new InMemoryEventBus(logger)

const productionPaymentProvider = createSquarePaymentProvider(
  config,
  logger,
  config.nodeEnv === "production" ? "production" : "sandbox"
)
const sandboxPaymentProvider = config.square.sandbox.accessToken
  ? createSquarePaymentProvider(config, logger, "sandbox")
  : null

export const paymentProvider = createDualEnvironmentPaymentProvider(
  productionPaymentProvider,
  sandboxPaymentProvider,
  logger
)

export const paymentErrorTranslator = createSquareErrorTranslator()

export const emailService =
  config.nodeEnv === 'development'
    ? createSmtpEmailService(config, logger)
    : createSendGridEmailService(config, logger)

export const userApiClient = createUserApiClient(config, logger)
export const homeUptickApiClient = createHomeUptickApiClient(config, logger, db)

export const healthMetricsService = createHealthMetricsService(
  transactionRepository,
  subscriptionRepository,
  billingLogRepository
)

export const healthReportService = createHealthReportService(healthMetricsService, emailService, logger)

export const criticalAlertService = createCriticalAlertService(emailService, config, logger)

export const whitelabelResolverService = createWhitelabelResolverService(db)

// Register event handlers
const emailNotificationHandler = new EmailNotificationHandler(emailService, logger)
const transactionLoggingHandler = new TransactionLoggingHandler(transactionRepository, logger)
const logFlushHandler = new LogFlushHandler(logger as DatabaseLogger, logger)
const rawCashOffersAccountHandler = new CashOffersAccountHandler(userApiClient, logger, productRepository, whitelabelRepository)
const rawHomeUptickAccountHandler = new HomeUptickAccountHandler(homeUptickApiClient, logger)
const cashOffersAccountHandler = new AdminAlertHandler(rawCashOffersAccountHandler, criticalAlertService, 'CashOffersAccountHandler', logger)
const homeUptickAccountHandler = new AdminAlertHandler(rawHomeUptickAccountHandler, criticalAlertService, 'HomeUptickAccountHandler', logger)

eventBus.subscribe("SubscriptionCreated", emailNotificationHandler)
eventBus.subscribe("SubscriptionRenewed", emailNotificationHandler)
eventBus.subscribe("PaymentFailed", emailNotificationHandler)
eventBus.subscribe("SubscriptionDeactivated", emailNotificationHandler)
eventBus.subscribe("SubscriptionPaused", emailNotificationHandler)
eventBus.subscribe("SubscriptionCancelled", emailNotificationHandler)
eventBus.subscribe("SubscriptionDowngraded", emailNotificationHandler)

eventBus.subscribe("PaymentProcessed", transactionLoggingHandler)
eventBus.subscribe("PaymentFailed", transactionLoggingHandler)

eventBus.subscribe("RequestCompleted", logFlushHandler)

// CashOffers account management (replaces PremiumActivation/Deactivation handlers)
eventBus.subscribe("SubscriptionCreated", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionRenewed", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionResumed", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionUpgraded", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionPaused", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionDeactivated", cashOffersAccountHandler)
eventBus.subscribe("SubscriptionCancelled", cashOffersAccountHandler)

// HomeUptick account management
eventBus.subscribe("SubscriptionCreated", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionRenewed", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionResumed", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionUpgraded", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionPaused", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionDeactivated", homeUptickAccountHandler)
eventBus.subscribe("SubscriptionCancelled", homeUptickAccountHandler)


export const configService: IConfigService = {
  get: (key: string) => {
    const value = (config as any)[key]
    if (typeof value === "object") return JSON.stringify(value)
    return String(value || "")
  },
  getOrThrow: (key: string) => {
    const value = (config as any)[key]
    if (!value) throw new Error(`Config key ${key} not found`)
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  },
  getAll: () => config as any,
}

logger.info("Services initialized", {
  environment: config.nodeEnv,
  port: config.port,
})
