import { describe, it, expect, vi, beforeEach } from "vitest"

// The use case's imports build the config singleton, which requires these; api/tests/setup.ts does
// not set them, and this test needs no real values.
vi.hoisted(() => {
  for (const key of ["DB_PASS", "NEXT_PUBLIC_SQUARE_LOCATION_ID", "NEXT_PUBLIC_SQUARE_APP_ID", "API_URL_V2"]) {
    process.env[key] = process.env[key] || "test"
  }
})

const { PurchaseNewUserUseCase } = await import("@api/use-cases/subscription/purchase-new-user.use-case")

/**
 * The server-side guard: an email that already has an account is refused before any card is
 * created or any charge is made. Without it, a caller that skips the signup page's browser check
 * is charged and left in pending_provisioning.
 */
const makeDeps = () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  paymentProvider: { createCard: vi.fn(), createPayment: vi.fn(), getCard: vi.fn(), refundPayment: vi.fn() },
  emailService: { sendEmail: vi.fn() },
  userApiClient: { getUserByEmail: vi.fn(), createUser: vi.fn(), getUser: vi.fn() },
  productRepository: { findById: vi.fn() },
  subscriptionRepository: {},
  userCardRepository: {},
  transactionRepository: {},
  purchaseRequestRepository: {
    create: vi.fn().mockResolvedValue({ request_id: 41, request_uuid: "uuid-41" }),
    updateStatus: vi.fn(),
    markAsFailed: vi.fn(),
  },
  homeUptickSubscriptionRepository: {},
  eventBus: { publish: vi.fn() },
  adminAlertEmail: "alerts@example.test",
  emailHasAccount: vi.fn(),
})

const input = {
  productId: 70,
  email: "guest@example.test",
  phone: "5555555555",
  cardToken: "cnon:card",
  expMonth: 12,
  expYear: 2030,
  cardholderName: "Guest Agent",
  name: "Guest Agent",
}

describe("PurchaseNewUserUseCase: existing email", () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps()
  })

  it("refuses an email that already has an account before touching the card or the charge", async () => {
    deps.emailHasAccount.mockResolvedValue(true)

    const result = await new PurchaseNewUserUseCase(deps as any).execute(input as any)

    expect(result).toMatchObject({ success: false, code: "EMAIL_EXISTS" })
    expect(deps.paymentProvider.createCard).not.toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
    expect(deps.productRepository.findById).not.toHaveBeenCalled()
    expect(deps.purchaseRequestRepository.markAsFailed).toHaveBeenCalledWith(41, expect.any(String), "EMAIL_EXISTS")
  })

  it("goes on to validate the product when the email is new", async () => {
    deps.emailHasAccount.mockResolvedValue(false)
    deps.productRepository.findById.mockResolvedValue(null) // stop right after the guard

    await new PurchaseNewUserUseCase(deps as any).execute(input as any)

    expect(deps.emailHasAccount).toHaveBeenCalledWith(input.email)
    expect(deps.productRepository.findById).toHaveBeenCalled()
    expect(deps.paymentProvider.createPayment).not.toHaveBeenCalled()
  })
})
