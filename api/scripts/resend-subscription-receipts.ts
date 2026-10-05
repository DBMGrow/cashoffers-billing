/**
 * Local dry run of `resendSkippedReceipts` (desk-1727): lists the receipts that would be resent and
 * renders each one, without sending. See the use case for which purchases qualify.
 *
 * It cannot send. SendGrid's IP allowlist refuses any host but production, so the real run is
 * `POST /api/cron/resend-subscription-receipts` with `apply: true`.
 *
 * Usage, production over the tunnel on :5432:
 *   NODE_ENV=production DB_HOST=127.0.0.1 DB_PORT=5432 dotenvx run -f .env.production -- \
 *     tsx --tsconfig api/tsconfig.json api/scripts/resend-subscription-receipts.ts [--out <dir>]
 *
 * `--out <dir>` saves each rendered receipt as HTML, to look at before the real run.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { db } from "@api/lib/database"
import { resendSkippedReceipts } from "@api/use-cases/subscription/resend-skipped-receipts"

const outArg = process.argv.indexOf("--out")
const outDir = outArg > -1 ? process.argv[outArg + 1] : null

resendSkippedReceipts({
  apply: false,
  onRendered: (subscriptionId, req) => {
    if (!outDir) return
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, `receipt-${subscriptionId}.html`), req.html)
  },
})
  .then((r) => {
    for (const s of r.sent)
      console.log(
        `would send  sub ${s.subscriptionId}  user ${s.userId}  "${s.subject}"  charged ${s.chargedAt.slice(0, 10)}`
      )
    console.log(
      `\nDRY RUN: would send ${r.sent.length}; sandbox skipped ${r.sandbox.length}; needs review ${r.needsReview.length}; already resent ${r.alreadyResent}`
    )
    if (r.sandbox.length) console.log(`  sandbox: subs ${r.sandbox.join(", ")}`)
    for (const n of r.needsReview) console.log(`  review: sub ${n.subscriptionId}: ${n.reason}`)
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => db.destroy())
