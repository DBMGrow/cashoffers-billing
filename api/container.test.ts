import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createContainer, getContainer, resetContainer } from './container'

describe('Container', () => {
  beforeEach(() => {
    // Env vars are set in api/tests/setup.ts (via vitest setupFiles)
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

    it('should have all services initialized', () => {
      const container = createContainer()

      expect(container.services).toBeDefined()
      expect(container.services.payment).toBeDefined()
      expect(container.services.email).toBeDefined()
      expect(container.services.userApi).toBeDefined()
    })

    it('should have all use cases initialized', () => {
      const container = createContainer()

      expect(container.useCases).toBeDefined()
      expect(container.useCases.createPayment).toBeDefined()
      expect(container.useCases.createSubscription).toBeDefined()
      expect(container.useCases.renewSubscription).toBeDefined()
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
