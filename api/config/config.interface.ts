/**
 * Payment Context - tracks request-level payment environment
 */
export interface PaymentContext {
  testMode: boolean
  source?: 'API' | 'CRON' | 'ADMIN'
  userId?: number
  metadata?: Record<string, unknown>
}

/**
 * Configuration interface
 * Centralizes all environment variables and application configuration
 */
export interface IConfig {
  // Server
  port: number
  nodeEnv: string
  environment: string

  // Database
  database: {
    host: string
    port: number
    user: string
    password: string
    name: string
  }

  // Square Payment API
  square: {
    production: {
      accessToken: string
      locationId: string
    }
    sandbox: {
      accessToken: string
      locationId: string
    }
    defaultEnvironment: 'production' | 'sandbox'
  }

  // External APIs
  api: {
    url: string
    urlV2: string
    masterToken: string
  }

  // Email
  sendgrid: {
    apiKey: string
    fromEmail: string
  }

  email: {
    adminEmail?: string
    devEmail: string
  }

  // Deprecated - use email.devEmail instead (defaults to devEmail if adminEmail not set)
  adminEmail: string

  // Cron
  cronSecret: string

  // Session
  sessionSecret: string
}

/**
 * Configuration Service Interface
 * For accessing configuration values
 */
export interface IConfigService {
  /**
   * Get a configuration value
   */
  get(key: string): string

  /**
   * Get a configuration value or throw if not found
   */
  getOrThrow(key: string): string

  /**
   * Get all configuration values
   */
  getAll(): Record<string, unknown>
}
