/**
 * Test data fixtures for E2E tests
 */

export const TEST_USERS = {
  newUser: {
    email: 'test-new@example.com',
    name: 'John Doe',
    slug: 'johndoe',
    broker: 'Test Brokerage',
    teamName: 'Test Team',
    phone: '(555) 123-4567',
  },
  existingAgent: {
    email: 'test-agent@example.com',
    name: 'Agent Smith',
    role: 'AGENT',
    whitelabel_id: 1,
  },
  existingInvestor: {
    email: 'test-investor@example.com',
    name: 'Investor Jane',
    role: 'INVESTOR',
    whitelabel_id: 1,
  },
  teamOwner: {
    email: 'test-teamowner@example.com',
    name: 'Team Owner',
    role: 'TEAMOWNER',
    whitelabel_id: 1,
  },
}

export const TEST_CARDS = {
  valid: {
    number: '4111111111111111',
    expMonth: '12',
    expYear: '2025',
    cvv: '123',
  },
  declined: {
    number: '4000000000000002',
    expMonth: '12',
    expYear: '2025',
    cvv: '123',
  },
  insufficientFunds: {
    number: '4000000000009995',
    expMonth: '12',
    expYear: '2025',
    cvv: '123',
  },
  expired: {
    number: '4111111111111111',
    expMonth: '01',
    expYear: '2020',
    cvv: '123',
  },
}

export const WHITELABELS = {
  default: {
    code: 'default',
    param: undefined, // No parameter for default
  },
  kw: {
    code: 'kw',
    param: 'kw',
  },
  yhs: {
    code: 'yhs',
    param: 'yhs',
  },
  uco: {
    code: 'uco',
    param: 'uco',
  },
  platinum: {
    code: 'platinum',
    param: 'platinum',
  },
  mop: {
    code: 'mop',
    param: 'mop',
  },
  eco: {
    code: 'eco',
    param: 'eco',
  },
}

export const PRODUCT_IDS = {
  free: 51, // Free Agent product (update to match actual DB product_id after migration)
  freeInvestor: 52, // Free Investor product (update to match actual DB product_id after migration)
  agentMonthly: 1,
  teamSmall: 2,
  teamMedium: 3,
  teamLarge: 4,
  investorMonthly: 11,
  platinumMonthly: 17,
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${prefix}-${timestamp}-${random}@example.com`
}

/**
 * Generate unique slug
 */
export function generateTestSlug(prefix: string = 'test'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${prefix}${timestamp}${random}`
}
