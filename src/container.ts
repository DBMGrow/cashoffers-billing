/**
 * Dependency Injection Container
 * Wires up all services and repositories
 */
import { createConfig } from '@/config/config.service'
import { createLogger } from '@/infrastructure/logging/structured.logger'
import type { IConfig } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'

/**
 * Application container
 * Holds all dependencies
 */
export interface IContainer {
  config: IConfig
  logger: ILogger
  // TODO: Add repositories, services, use cases as we build them
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

  logger.info('Application container initialized', {
    environment: config.nodeEnv,
    port: config.port,
  })

  return {
    config,
    logger,
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
