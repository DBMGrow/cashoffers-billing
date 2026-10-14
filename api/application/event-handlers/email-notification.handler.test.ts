// NOTE: the runtime imports are deferred into `beforeEach`. The #1494 suite was
// `describe.skip`-ed because a static import of the handler did not resolve under
// vitest at the time; it resolves now (checked for #1170), so both suites run.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { EmailNotificationHandler as EmailNotificationHandlerClass } from "./email-notification.handler"
import { FIRST_CHARGE_CASES, TRIAL_DAYS } from "@api/tests/fixtures/first-charge-instants"

// Mock module-level singletons the handler imports.
vi.mock("@api/lib/services", () => ({
  whitelabelResolverService: {
    resolveForUser: vi.fn(async () => ({ name: "kw Offerings", branding: {} })),
  },
  userApiClient: { getUser: vi.fn() },
}))
vi.mock("@api/lib/repositories", () => ({
  whitelabelRepository: { getSuspensionBehavior: vi.fn(async () => "DOWNGRADE_TO_FREE") },
  productRepository: { findById: vi.fn(async () => null) },
  subscriptionRepository: { findById: vi.fn(async () => null) },
}))
// Avoid rendering the full React email tree in a unit test.
vi.mock("@react-email/render", () => ({ render: vi.fn(async () => "<html>email</html>") }))

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() } as any
}

describe("EmailNotificationHandler — integration-managed downgrade email suppression (#1494)", () => {
  // Resolved lazily in beforeEach so a static import doesn't crash collection (see file header).
  let EmailNotificationHandler: typeof EmailNotificationHandlerClass
  let SubscriptionCancelledEvent: any
  let mockedGetUser: ReturnType<typeof vi.fn>
  let emailService: { sendEmail: ReturnType<typeof vi.fn>; sendPlainEmail: ReturnType<typeof vi.fn> }
  let handler: EmailNotificationHandlerClass

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ EmailNotificationHandler } = await import("./email-notification.handler"))
    ;({ SubscriptionCancelledEvent } = await import("@api/domain/events/subscription-cancelled.event"))
    const { userApiClient } = await import("@api/lib/services")
    mockedGetUser = userApiClient.getUser as unknown as ReturnType<typeof vi.fn>
    emailService = { sendEmail: vi.fn(), sendPlainEmail: vi.fn() }
    handler = new EmailNotificationHandler(emailService as any, makeLogger())
  })

  it("does NOT send a 'Downgraded to Free' email for an integration-managed user", async () => {
    mockedGetUser.mockResolvedValue({ id: 26126, whitelabel_id: 2, integration_id: 1 })

    await handler.handle(
      SubscriptionCancelledEvent.create({
        subscriptionId: 154,
        userId: 26126,
        email: "soldbyangelina@kw.com",
        subscriptionName: "KW",
        cancelOnRenewal: false,
      })
    )

    expect(emailService.sendEmail).not.toHaveBeenCalled()
  })

  it("DOES send the 'Downgraded to Free' email for a non-integration user", async () => {
    mockedGetUser.mockResolvedValue({ id: 555, whitelabel_id: 2, integration_id: null })

    await handler.handle(
      SubscriptionCancelledEvent.create({
        subscriptionId: 200,
        userId: 555,
        email: "b@example.com",
        subscriptionName: "Pro",
        cancelOnRenewal: false,
      })
    )

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail.mock.calls[0][0].subject).toMatch(/Downgraded to Free/i)
  })
})

describe("EmailNotificationHandler: SubscriptionCreated for a free trial (Desk #1350)", () => {
  let EmailNotificationHandler: typeof EmailNotificationHandlerClass
  let SubscriptionCreatedEvent: any
  let TrialWelcomeEmail: any
  let findSubscription: ReturnType<typeof vi.fn>
  let render: ReturnType<typeof vi.fn>
  let emailService: { sendEmail: ReturnType<typeof vi.fn>; sendPlainEmail: ReturnType<typeof vi.fn> }
  let handler: EmailNotificationHandlerClass

  const endsAt = "2026-11-11T20:00:00.000Z"

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ EmailNotificationHandler } = await import("./email-notification.handler"))
    ;({ SubscriptionCreatedEvent } = await import("@api/domain/events/subscription-created.event"))
    ;({ default: TrialWelcomeEmail } = await import("@api/infrastructure/email/templates/trial-welcome.email"))
    const repositories = await import("@api/lib/repositories")
    findSubscription = repositories.subscriptionRepository.findById as unknown as ReturnType<typeof vi.fn>
    findSubscription.mockResolvedValue(null)
    render = (await import("@react-email/render")).render as unknown as ReturnType<typeof vi.fn>
    emailService = { sendEmail: vi.fn(), sendPlainEmail: vi.fn() }
    handler = new EmailNotificationHandler(emailService as any, makeLogger())
  })

  function created(overrides: Record<string, unknown> = {}) {
    return SubscriptionCreatedEvent.create({
      subscriptionId: 900,
      userId: 42,
      email: "agent@example.com",
      productId: 70,
      productName: "InstantOffers365 Individual",
      amount: 25000,
      initialChargeAmount: 0,
      nextRenewalDate: new Date(endsAt),
      environment: "production",
      ...overrides,
    })
  }

  /** Props of the TrialWelcomeEmail element handed to render(), or undefined when none was rendered. */
  function welcomeProps() {
    const call = render.mock.calls.find(([element]: any[]) => element?.type === TrialWelcomeEmail)
    return call?.[0].props
  }

  it("trial marker drives trial-welcome with the trial's days, end date and first charge", async () => {
    findSubscription.mockResolvedValue({ data: JSON.stringify({ trial: { ends_at: endsAt, duration_days: 30 } }) })

    await handler.handle(created())

    expect(findSubscription).toHaveBeenCalledWith(900)
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ to: "agent@example.com", templateName: "trial-welcome" })
    )
    expect(welcomeProps()).toEqual(
      expect.objectContaining({
        trialDays: 30,
        expirationDate: "November 11, 2026",
        firstCharge: { subscription: "InstantOffers365 Individual", amount: "$250.00" },
      })
    )
  })

  it("reads the marker from event metadata without a database read", async () => {
    await handler.handle(
      SubscriptionCreatedEvent.create(
        {
          subscriptionId: 901,
          userId: 42,
          email: "agent@example.com",
          productId: 70,
          productName: "InstantOffers365 Team",
          amount: 99000,
          initialChargeAmount: 0,
        },
        { subscriptionTrial: { ends_at: endsAt, duration_days: 14 } }
      )
    )

    expect(findSubscription).not.toHaveBeenCalled()
    expect(welcomeProps()).toEqual(
      expect.objectContaining({
        trialDays: 14,
        firstCharge: { subscription: "InstantOffers365 Team", amount: "$990.00" },
      })
    )
  })

  it("a $0 product without data.trial behaves as today: no email", async () => {
    await handler.handle(created({ productName: "Free Plan", amount: 0 }))

    expect(emailService.sendEmail).not.toHaveBeenCalled()
  })

  it("a HomeUptick trial (no marker) keeps the name-heuristic welcome with no charge line", async () => {
    await handler.handle(created({ productName: "HomeUptick Trial", amount: 0 }))

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail.mock.calls[0][0].templateName).toBe("trial-welcome")
    expect(welcomeProps()).toEqual(expect.objectContaining({ trialDays: 90 }))
    expect(welcomeProps().firstCharge).toBeUndefined()
  })

  it("a promo-covered $0 signup without the marker still gets the receipt", async () => {
    await handler.handle(created())

    expect(findSubscription).toHaveBeenCalledWith(900)
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(emailService.sendEmail.mock.calls[0][0].templateName).toBe("subscription-created")
  })

  it("a paid signup never reads the subscription row", async () => {
    await handler.handle(created({ initialChargeAmount: 25000 }))

    expect(findSubscription).not.toHaveBeenCalled()
    expect(emailService.sendEmail.mock.calls[0][0].templateName).toBe("subscription-created")
  })

  // D3, AC26: the welcome names the UTC day the hourly run charges on, the day the review step
  // showed, whatever zone the server runs in.
  describe("names the UTC day the charging run falls on (D3, AC26)", () => {
    const ORIGINAL_TZ = process.env.TZ
    afterEach(() => {
      process.env.TZ = ORIGINAL_TZ
    })

    for (const c of FIRST_CHARGE_CASES) {
      for (const zone of ["UTC", "America/Los_Angeles", "Asia/Manila"]) {
        it(`a signup at ${c.name}, on a server in ${zone}: ${c.firstCharge}`, async () => {
          process.env.TZ = zone
          findSubscription.mockResolvedValue({
            data: JSON.stringify({ trial: { ends_at: c.endsAt, duration_days: TRIAL_DAYS } }),
          })

          await handler.handle(created({ nextRenewalDate: new Date(c.endsAt) }))

          expect(welcomeProps().expirationDate).toBe(c.firstCharge)
        })
      }
    }
  })
})
