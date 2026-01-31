import { IConfig } from './config.interface'

/**
 * Configuration Service
 * Single source of truth for all environment variables
 */
export const createConfig = (): IConfig => {
  // Validate required environment variables
  const required = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_ENVIRONMENT',
    'SQUARE_LOCATION_ID',
    'API_URL',
    'API_URL_V2',
    'API_MASTER_TOKEN',
    'SENDGRID_API_KEY',
    'ADMIN_EMAIL',
    'SESSION_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  const squareEnv = process.env.SQUARE_ENVIRONMENT
  if (squareEnv !== 'production' && squareEnv !== 'sandbox') {
    throw new Error('SQUARE_ENVIRONMENT must be "production" or "sandbox"')
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    database: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      name: process.env.DB_NAME!,
    },

    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN!,
      environment: squareEnv as 'production' | 'sandbox',
      locationId: process.env.SQUARE_LOCATION_ID!,
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

    adminEmail: process.env.ADMIN_EMAIL!,
    cronSecret: process.env.CRON_SECRET || 'default-cron-secret',
    sessionSecret: process.env.SESSION_SECRET!,
  }
}
