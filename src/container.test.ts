import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createContainer, getContainer, resetContainer } from './container'

describe('Container', () => {
  beforeEach(() => {
    // Setup test environment variables
    process.env.DB_HOST = 'localhost'
    process.env.DB_PORT = '3306'
    process.env.DB_USER = 'test'
    process.env.DB_PASSWORD = 'test'
    process.env.DB_NAME = 'test'
    process.env.SQUARE_ACCESS_TOKEN = 'test'
    process.env.SQUARE_ENVIRONMENT = 'sandbox'
    process.env.SQUARE_LOCATION_ID = 'test'
    process.env.API_URL = 'http://localhost:3000'
    process.env.API_URL_V2 = 'http://localhost:3000/v2'
    process.env.API_MASTER_TOKEN = 'test'
    process.env.SENDGRID_API_KEY = 'test'
    process.env.ADMIN_EMAIL = 'admin@test.com'
    process.env.SESSION_SECRET = 'test'

    resetContainer()
  })

  afterEach(() => {
    resetContainer()
  })

  describe('createContainer', () => {
    it('should create a container with config and logger', () => {
      const container = createContainer()

      expect(container).toBeDefined()
      expect(container.config).toBeDefined()
      expect(container.logger).toBeDefined()
      expect(container.db).toBeDefined()
      expect(container.repositories).toBeDefined()
    })

    it('should have valid configuration', () => {
      const container = createContainer()

      expect(container.config.port).toBeGreaterThan(0)
      expect(container.config.nodeEnv).toBeDefined()
      expect(container.config.database).toBeDefined()
      expect(container.config.square).toBeDefined()
      expect(container.config.api).toBeDefined()
    })

    it('should have all repositories initialized', () => {
      const container = createContainer()

      expect(container.repositories.transaction).toBeDefined()
      expect(container.repositories.subscription).toBeDefined()
      expect(container.repositories.userCard).toBeDefined()
      expect(container.repositories.product).toBeDefined()
    })

    it('should have a working logger', () => {
      const container = createContainer()

      // Should not throw
      expect(() => {
        container.logger.info('Test message')
        container.logger.warn('Test warning')
        container.logger.error('Test error')
        container.logger.debug('Test debug')
      }).not.toThrow()
    })

    it('should create child logger with context', () => {
      const container = createContainer()
      const childLogger = container.logger.child({ userId: 123 })

      expect(childLogger).toBeDefined()
      expect(() => {
        childLogger.info('Test with context')
      }).not.toThrow()
    })
  })

  describe('getContainer', () => {
    it('should return the same container instance', () => {
      const container1 = getContainer()
      const container2 = getContainer()

      expect(container1).toBe(container2)
    })

    it('should create container on first call', () => {
      const container = getContainer()

      expect(container).toBeDefined()
      expect(container.config).toBeDefined()
      expect(container.logger).toBeDefined()
    })
  })

  describe('resetContainer', () => {
    it('should reset the global container', () => {
      const container1 = getContainer()
      resetContainer()
      const container2 = getContainer()

      expect(container1).not.toBe(container2)
    })
  })
})
