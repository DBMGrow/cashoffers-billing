import { vi } from 'vitest'
import type { ILogger } from '@api/infrastructure/logging/logger.interface'
import type { IUserApiClient } from '@api/infrastructure/external-api/user-api.interface'

/**
 * Creates a no-op logger that satisfies ILogger without any output.
 * Child loggers return themselves so tests don't need to chain mocks.
 */
export function makeLogger(): ILogger {
  const logger: ILogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis() as unknown as ILogger['child'],
  }
  // Make child() return the same mock object
  ;(logger.child as ReturnType<typeof vi.fn>).mockReturnValue(logger)
  return logger
}

/**
 * Creates a mock IUserApiClient with all methods stubbed.
 */
export function makeUserApiClient(): IUserApiClient {
  return {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    activateUserPremium: vi.fn(),
    deactivateUserPremium: vi.fn(),
    deactivateUser: vi.fn(),
    activateUser: vi.fn(),
    abandonUser: vi.fn(),
  } as unknown as IUserApiClient
}

/**
 * Creates a mock IHomeUptickApiClient with all methods stubbed.
 * Import shape mirrors the interface that will live at:
 *   api/infrastructure/external-api/homeuptick-api/homeuptick-api.interface.ts
 */
export function makeHomeUptickApiClient() {
  return {
    createAccount: vi.fn().mockResolvedValue(undefined),
    activateAccount: vi.fn().mockResolvedValue(undefined),
    deactivateAccount: vi.fn().mockResolvedValue(undefined),
    getClientCount: vi.fn().mockResolvedValue(0),
    setContactLimit: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * Creates a minimal mock subscription repository for use in use-case tests.
 */
export function makeSubscriptionRepository() {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findActiveByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

/**
 * Builds a product data object with cashoffers + homeuptick modules configured.
 */
export function makeProductData(overrides?: {
  cashofffersManaged?: boolean
  huEnabled?: boolean
  role?: string
  is_premium?: 0 | 1
  whitelabel_id?: number | null
  is_team_plan?: boolean
  huBaseContacts?: number
  huContactsPerTier?: number
  huPricePerTier?: number
  huFreeTrial?: boolean
}) {
  const {
    cashofffersManaged = true,
    huEnabled = false,
    role = 'AGENT',
    is_premium = 1,
    whitelabel_id = null,
    is_team_plan = false,
    huBaseContacts = 500,
    huContactsPerTier = 1000,
    huPricePerTier = 7500,
    huFreeTrial = false,
  } = overrides ?? {}

  return {
    signup_fee: 0,
    renewal_cost: 25000,
    duration: 'monthly' as const,
    cashoffers: {
      managed: cashofffersManaged,
      user_config: {
        is_premium,
        role,
        whitelabel_id,
        is_team_plan,
      },
    },
    homeuptick: {
      enabled: huEnabled,
      base_contacts: huBaseContacts,
      contacts_per_tier: huContactsPerTier,
      price_per_tier: huPricePerTier,
      free_trial: huFreeTrial
        ? { enabled: true, contacts: 100, duration_days: 90 }
        : undefined,
    },
  }
}

/**
 * Builds a minimal subscription row as returned from the repository.
 */
export function makeSubscriptionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    subscription_id: 1,
    user_id: 42,
    product_id: 10,
    subscription_name: 'Premium Monthly',
    amount: 25000,
    status: 'active',
    renewal_date: new Date('2026-04-17'),
    next_renewal_attempt: null,
    cancel_on_renewal: false,
    downgrade_on_renewal: false,
    suspension_date: null,
    square_environment: 'sandbox',
    data: null,
    ...overrides,
  }
}
