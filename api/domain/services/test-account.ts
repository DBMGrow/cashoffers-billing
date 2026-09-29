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
 * Buyers whose email ends with this domain may purchase in test mode without any capability.
 *
 * Why: it is how we demo the purchase flow in production with a sandbox card (for example a
 * partner walkthrough), and it was already the test-account convention in the old TestModeDetector.
 * Anyone can type an address on this domain, so the rule does not prove who the buyer is: it only
 * keeps sandbox purchases confined to accounts that are recognisably test accounts.
 */
export const TEST_MODE_EMAIL_DOMAIN = "@test.cashoffers.com"

/** Square's sandbox test card nonce: a card that always succeeds in the sandbox. */
export const SANDBOX_TEST_CARD_NONCE = "cnon:card-nonce-ok"

/** True when the email belongs to the test-account domain (case-insensitive). */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(TEST_MODE_EMAIL_DOMAIN)
}
