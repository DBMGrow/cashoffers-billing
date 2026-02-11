/**
 * Test Mode Authorizer Interface
 */
export interface ITestModeAuthorizer {
  /**
   * Check if user is authorized to use test mode
   * @throws Error if user lacks permission
   */
  authorize(user: any, testMode: boolean): void
}

/**
 * Test Mode Authorizer Service
 * Ensures only authorized users can use test/sandbox mode
 */
export class TestModeAuthorizer implements ITestModeAuthorizer {
  authorize(user: any, testMode: boolean): void {
    if (!testMode) {
      // No authorization needed for production mode
      return
    }

    if (!this.hasTestModePermission(user)) {
      throw new Error('Test mode requires payments_test_mode permission')
    }
  }

  /**
   * Check if user has permission to use test mode
   */
  private hasTestModePermission(user: any): boolean {
    // Check if user has the specific test mode permission
    const capabilities = user?.capabilities || []
    return capabilities.includes('payments_test_mode')
  }
}

/**
 * Create a test mode authorizer
 */
export const createTestModeAuthorizer = (): ITestModeAuthorizer => {
  return new TestModeAuthorizer()
}
