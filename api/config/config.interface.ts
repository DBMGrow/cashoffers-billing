/**
 * Payment Context - tracks request-level payment environment
 */
export interface PaymentContext {
  testMode: boolean
  source?: "API" | "CRON" | "ADMIN"
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
      appId: string
    }
    sandbox: {
      accessToken: string
      locationId: string
      appId: string
    }
    defaultEnvironment: "production" | "sandbox"
  }

  // External APIs
  api: {
    url: string
    masterToken: string
    key: string // API_KEY - token for calling main auth API
    route?: string // API_ROUTE - internal/billing API base URL (optional)
  }

  // App
  app: {
    url: string // APP_URL - public app URL (e.g. billing.cashoffers.com)
  }

  // JWT
  jwtSecret: string // JWT_SECRET

  // HomeUptick integration (optional)
  homeuptickUrl?: string // HOMEUPTICK_URL

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

  // SMTP (local development only)
  smtp?: {
    host: string
    port: number
    secure: boolean
    user?: string
    pass?: string
    fromEmail?: string
  }

  // Cron
  cronSecret: string

  // Webhooks
  webhookSecret?: string
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
