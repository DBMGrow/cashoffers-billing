import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock module-level singletons the handler imports.
vi.mock("@api/lib/services", () => ({
  whitelabelResolverService: {
    resolveForUser: vi.fn(async () => ({ name: "kw Offerings", branding: {} })),
  },
  userApiClient: { getUser: vi.fn() },
}))
vi.mock("@api/lib/repositories", () => ({
  whitelabelRepository: { getSuspensionBehavior: vi.fn(async () => "DOWNGRADE_TO_FREE") },
}))
// Avoid rendering the full React email tree in a unit test.
vi.mock("@react-email/render", () => ({ render: vi.fn(async () => "<html>email</html>") }))

import { EmailNotificationHandler } from "./email-notification.handler"
import { userApiClient } from "@api/lib/services"
import { SubscriptionCancelledEvent } from "@api/domain/events/subscription-cancelled.event"

const mockedGetUser = userApiClient.getUser as unknown as ReturnType<typeof vi.fn>

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() } as any
}

describe("EmailNotificationHandler — integration-managed downgrade email suppression (#1494)", () => {
  let emailService: { sendEmail: ReturnType<typeof vi.fn>; sendPlainEmail: ReturnType<typeof vi.fn> }
  let handler: EmailNotificationHandler

  beforeEach(() => {
    vi.clearAllMocks()
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
