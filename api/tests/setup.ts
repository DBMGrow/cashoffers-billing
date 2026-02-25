/**
 * Vitest global test setup
 * Sets required environment variables before any modules are imported.
 * This file runs before test files, ensuring config.service.ts singleton
 * initializes with valid values in test environments.
 */

/* eslint-disable no-restricted-syntax */
process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || '3306'
process.env.DB_USER = process.env.DB_USER || 'test'
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test'
process.env.DB_NAME = process.env.DB_NAME || 'test'
process.env.SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || 'test'
process.env.SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox'
process.env.SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || 'test'
process.env.API_URL = process.env.API_URL || 'http://localhost:3000'
process.env.API_URL_V2 = process.env.API_URL_V2 || 'http://localhost:3000/v2'
process.env.API_MASTER_TOKEN = process.env.API_MASTER_TOKEN || 'test-master-token'
process.env.API_KEY = process.env.API_KEY || 'test-api-key'
process.env.API_ROUTE_AUTH = process.env.API_ROUTE_AUTH || 'http://localhost:3000'
process.env.API_ROUTE_AUTH_V2 = process.env.API_ROUTE_AUTH_V2 || 'http://localhost:3000/v2'
process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'test-sendgrid-key'
process.env.DEV_EMAIL = process.env.DEV_EMAIL || 'dev@test.com'
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
