/**
 * Shown on the account site's checkout for a test account (email on the test domain, see
 * api/domain/services/test-account.ts), in place of the card form. The server runs these purchases
 * in the Square sandbox, so no real card is charged.
 */
export default function TestAccountNotice() {
  return (
    <div role="status" className="p-4 border border-warning/40 bg-warning/10 rounded-lg">
      <p className="font-semibold text-sm">Test account</p>
      <p className="text-sm text-gray-600">This purchase runs in Square&apos;s sandbox and no card is charged.</p>
    </div>
  )
}
