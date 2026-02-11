import { IConfig } from './config.interface'

/**
 * Configuration Service
 * Single source of truth for all environment variables
 */
export const createConfig = (): IConfig => {
  // Validate required environment variables (production Square credentials required)
  const required = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_LOCATION_ID',
    'API_URL',
    'API_URL_V2',
    'API_MASTER_TOKEN',
    'SENDGRID_API_KEY',
    'DEV_EMAIL',
    'SESSION_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Determine default environment (backward compatible with SQUARE_ENVIRONMENT)
  const defaultEnv = process.env.SQUARE_ENVIRONMENT || 'production'
  if (defaultEnv !== 'production' && defaultEnv !== 'sandbox') {
    throw new Error('SQUARE_ENVIRONMENT must be "production" or "sandbox"')
  }

  // Check if sandbox credentials are provided (optional)
  const hasSandboxCredentials =
    !!process.env.SQUARE_SANDBOX_ACCESS_TOKEN && !!process.env.SQUARE_SANDBOX_LOCATION_ID

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    environment: process.env.NODE_ENV || 'development',

    database: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      name: process.env.DB_NAME!,
    },

    square: {
      production: {
        accessToken: process.env.SQUARE_ACCESS_TOKEN!,
        locationId: process.env.SQUARE_LOCATION_ID!,
      },
      sandbox: {
        accessToken: process.env.SQUARE_SANDBOX_ACCESS_TOKEN || '',
        locationId: process.env.SQUARE_SANDBOX_LOCATION_ID || '',
      },
      defaultEnvironment: defaultEnv as 'production' | 'sandbox',
    },

    api: {
      url: process.env.API_URL!,
      urlV2: process.env.API_URL_V2!,
      masterToken: process.env.API_MASTER_TOKEN!,
    },

    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY!,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@cashoffers.com',
    },

    email: {
      adminEmail: process.env.ADMIN_EMAIL || undefined,
      devEmail: process.env.DEV_EMAIL!,
    },

    adminEmail: process.env.ADMIN_EMAIL || process.env.DEV_EMAIL!, // Backward compatibility
    cronSecret: process.env.CRON_SECRET || 'default-cron-secret',
    sessionSecret: process.env.SESSION_SECRET!,
  }
}
