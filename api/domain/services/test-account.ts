/**
 * Test accounts: the email domain that marks an account as a test account, shared by the server's
 * test mode rule (api/infrastructure/payment/test-mode-policy.ts) and the account site.
 *
 * Pure, with no server imports, so the browser bundle can use it. The server rule is the only
 * authority on whether a purchase runs in the Square sandbox. The account site reads
 * `isTestAccountEmail` only to skip the card form and send the sandbox test nonce; if the two ever
 * disagree, the server refuses the purchase (403 TEST_MODE_NOT_ALLOWED) before any card or charge
 * work.
 */

/**
 * Buyers whose email ends with one of these domains may purchase in test mode without any capability.
 *
 * Why: it is how we demo the purchase flow in production with a sandbox card (for example a
 * partner walkthrough), and it was already the test-account convention in the old TestModeDetector.
 * `@dbmgrow.com` is our own team, who run those walkthroughs from their work addresses (David,
 * 2026-09-29). Anyone can type an address on the test domain, so the rule does not prove who the
 * buyer is: it only keeps sandbox purchases confined to accounts that are recognisably ours.
 *
 * Each entry starts with "@", so a subdomain (`a@sub.dbmgrow.com`) or a lookalike
 * (`a@notdbmgrow.com`) never matches.
 */
export const TEST_MODE_EMAIL_DOMAINS = ["@test.cashoffers.com", "@dbmgrow.com"] as const

/** The original test-account domain, kept for callers that name it. */
export const TEST_MODE_EMAIL_DOMAIN = TEST_MODE_EMAIL_DOMAINS[0]

/** Square's sandbox test card nonce: a card that always succeeds in the sandbox. */
export const SANDBOX_TEST_CARD_NONCE = "cnon:card-nonce-ok"

/** True when the email belongs to one of the test-account domains (case-insensitive). */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false
  const normalized = email.trim().toLowerCase()
  return TEST_MODE_EMAIL_DOMAINS.some((domain) => normalized.endsWith(domain))
}
