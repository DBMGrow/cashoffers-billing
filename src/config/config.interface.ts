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
