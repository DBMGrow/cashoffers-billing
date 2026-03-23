import { IConfig } from "./config.interface"

/**
 * Configuration Service
 * Single source of truth for all environment variables.
 * Exports a singleton `config` object - do not access process.env elsewhere.
 */
const buildConfig = (): IConfig => {
  // Validate required environment variables
  const required = [
    "DB_HOST",
    "DB_USER",
    "DB_PASS",
    "DB_NAME",
    "SQUARE_ACCESS_TOKEN",
    "NEXT_PUBLIC_SQUARE_LOCATION_ID",
    "NEXT_PUBLIC_SQUARE_APP_ID",
    "API_URL",
    "API_MASTER_TOKEN",
    "API_KEY",
    "SENDGRID_API_KEY",
    "DEV_EMAIL",
    "JWT_SECRET",
  ]

  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  // Determine default environment (backward compatible with SQUARE_ENVIRONMENT)
  const defaultEnv = process.env.SQUARE_ENVIRONMENT || "production"
  if (defaultEnv !== "production" && defaultEnv !== "sandbox") {
    throw new Error('SQUARE_ENVIRONMENT must be "production" or "sandbox"')
  }

  return {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    environment: process.env.NODE_ENV || "development",

    database: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER!,
      password: process.env.DB_PASS!,
      name: process.env.DB_NAME!,
    },

    square: {
      production: {
        accessToken: process.env.SQUARE_ACCESS_TOKEN!,
        locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
        appId: process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
      },
      sandbox: {
        accessToken: process.env.SQUARE_SANDBOX_ACCESS_TOKEN || "",
        locationId: process.env.SQUARE_SANDBOX_LOCATION_ID || "",
        appId: process.env.SQUARE_SANDBOX_APP_ID || "",
      },
      defaultEnvironment: defaultEnv as "production" | "sandbox",
    },

    api: {
      url: process.env.API_URL!,
      masterToken: process.env.API_MASTER_TOKEN!,
      key: process.env.API_KEY!,
      route: process.env.API_ROUTE,
    },

    app: {
      url: process.env.APP_URL || "https://billing.cashoffers.com",
    },

    jwtSecret: process.env.JWT_SECRET!,

    homeuptickUrl: process.env.HOMEUPTICK_URL,

    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY!,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@cashoffers.com",
    },

    email: {
      adminEmail: process.env.ADMIN_EMAIL || undefined,
      devEmail: process.env.DEV_EMAIL!,
    },

    adminEmail: process.env.ADMIN_EMAIL || process.env.DEV_EMAIL!, // Backward compatibility

    smtp: {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "1025", 10),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      fromEmail: process.env.SMTP_FROM_EMAIL || undefined,
    },

    cronSecret: process.env.CRON_SECRET || "default-cron-secret",

    webhookSecret: process.env.CASHOFFERS_WEBHOOK_SECRET,
  }
}

export const config: IConfig = buildConfig()
