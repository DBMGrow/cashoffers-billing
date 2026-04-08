import type { Context as HonoContext } from 'hono'
import type { PaymentContext } from '@api/config/config.interface'

/**
 * Test Mode Detector Interface
 */
export interface ITestModeDetector {
  /**
   * Detect test mode from request and user context
   */
  detectTestMode(c: HonoContext, user?: any): PaymentContext
}

/**
 * Test Mode Detector Service
 * Detects when test/sandbox mode should be used based on request parameters
 */
export class TestModeDetector implements ITestModeDetector {
  detectTestMode(c: HonoContext, user?: any): PaymentContext {
    // Check multiple sources for test mode flag
    const testMode =
      c.req.query('test_mode') === 'true' ||
      c.req.header('X-Test-Mode') === 'true' ||
      user?.email?.endsWith('@test.cashoffers.com') ||
      false

    const detectionSource = this.getDetectionSource(c, user, testMode)

    return {
      testMode,
      source: 'API',
      userId: user?.id || user?.user_id,
      metadata: {
        detectedFrom: detectionSource,
        timestamp: new Date().toISOString(),
      },
    }
  }

  /**
   * Determine where test mode was detected from (for logging)
   */
  private getDetectionSource(c: HonoContext, user: any, testMode: boolean): string {
    if (!testMode) return 'none'
    if (c.req.query('test_mode') === 'true') return 'query_parameter'
    if (c.req.header('X-Test-Mode') === 'true') return 'header'
    if (user?.email?.endsWith('@test.cashoffers.com')) return 'user_email'
    return 'unknown'
  }
}

/**
 * Create a test mode detector
 */
export const createTestModeDetector = (): ITestModeDetector => {
  return new TestModeDetector()
}
