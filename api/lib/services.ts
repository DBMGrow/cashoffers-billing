import { db } from "@api/lib/database"
import {
  billingLogRepository,
  transactionRepository,
  subscriptionRepository,
  whitelabelRepository,
} from "@api/lib/repositories"
import { config } from "@api/config/config.service"
import type { IConfigService } from "@api/config/config.interface"
import { createLogger } from "@api/infrastructure/logging/structured.logger"
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
import { PremiumActivationHandler } from "@api/application/event-handlers/premium-activation.handler"
import { PremiumDeactivationHandler } from "@api/application/event-handlers/premium-deactivation.handler"
import { createHealthMetricsService } from "@api/domain/services/health-metrics.service"
import { createHealthReportService } from "@api/domain/services/health-report.service"
import { createCriticalAlertService } from "@api/domain/services/critical-alert.service"

// Base logger (console only — no DB dependency)
const baseLogger = createLogger({ service: "cashoffers-billing" }, config.nodeEnv === "production" ? "info" : "debug")

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

export const healthMetricsService = createHealthMetricsService(
  transactionRepository,
  subscriptionRepository,
  billingLogRepository
)

export const healthReportService = createHealthReportService(healthMetricsService, emailService, logger)

export const criticalAlertService = createCriticalAlertService(emailService, config, logger)

// Register event handlers
const emailNotificationHandler = new EmailNotificationHandler(emailService, logger)
const transactionLoggingHandler = new TransactionLoggingHandler(transactionRepository, logger)
const logFlushHandler = new LogFlushHandler(logger as DatabaseLogger, logger)
const premiumActivationHandler = new PremiumActivationHandler(userApiClient, logger)
const premiumDeactivationHandler = new PremiumDeactivationHandler(
  userApiClient,
  whitelabelRepository,
  subscriptionRepository,
  logger
)

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

eventBus.subscribe("SubscriptionCreated", premiumActivationHandler)
eventBus.subscribe("SubscriptionRenewed", premiumActivationHandler)

eventBus.subscribe("SubscriptionDeactivated", premiumDeactivationHandler)
eventBus.subscribe("SubscriptionPaused", premiumDeactivationHandler)

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
