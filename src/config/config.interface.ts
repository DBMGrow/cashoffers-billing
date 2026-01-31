/**
 * Configuration interface
 * Centralizes all environment variables and application configuration
 */
export interface IConfig {
  // Server
  port: number
  nodeEnv: string

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
    accessToken: string
    environment: 'production' | 'sandbox'
    locationId: string
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

  // Admin
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
