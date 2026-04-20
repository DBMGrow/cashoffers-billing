#!/usr/bin/env tsx
/**
 * Dev CLI — CashOffers Billing Developer Tools
 * Usage: yarn dev:tools <command> [options]
 */

import { Command } from "commander"
import { spawnSync } from "child_process"
import path from "path"

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.DEV_CLI_URL || `http://localhost:${process.env.PORT || 3000}/api/dev`

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}

function bold(s: string) { return `${C.bold}${s}${C.reset}` }
function dim(s: string) { return `${C.dim}${s}${C.reset}` }
function red(s: string) { return `${C.red}${s}${C.reset}` }
function green(s: string) { return `${C.green}${s}${C.reset}` }
function yellow(s: string) { return `${C.yellow}${s}${C.reset}` }
function cyan(s: string) { return `${C.cyan}${s}${C.reset}` }
function gray(s: string) { return `${C.gray}${s}${C.reset}` }

function header(title: string) {
  const line = "─".repeat(60)
  console.log(`\n${C.bold}${C.blue}${line}${C.reset}`)
  console.log(`${C.bold}${C.blue}  ${title}${C.reset}`)
  console.log(`${C.bold}${C.blue}${line}${C.reset}`)
}

function section(title: string) {
  console.log(`\n${bold(title)}`)
  console.log(dim("─".repeat(title.length)))
}

function kv(key: string, value: unknown, indent = 0) {
  const pad = " ".repeat(indent)
  const val = value == null ? gray("null") : String(value)
  console.log(`${pad}${cyan(key + ":")} ${val}`)
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const url = `${BASE_URL}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch (err: any) {
    console.error(red(`\n✗ Could not connect to ${BASE_URL}`))
    console.error(dim("  Make sure the dev server is running: yarn dev"))
    console.error(dim(`  Error: ${err?.message ?? String(err)}\n`))
    process.exit(1)
  }

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.success === "error") {
    console.error(red(`\n✗ ${method} ${path} → ${res.status}`))
    if (json?.error) console.error(red(`  ${json.error}`))
    else console.error(red(`  ${JSON.stringify(json)}`))
    process.exit(1)
  }

  return json?.data ?? json
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdSystem() {
  header("System Overview")
  const data = await api("GET", "/system")

  section("Subscriptions by status")
  for (const [status, count] of Object.entries(data.subscriptions_by_status ?? {})) {
    const color = status === "active" ? green : status === "cancelled" ? red : yellow
    console.log(`  ${color(status.padEnd(12))} ${bold(String(count))}`)
  }

  section("Overdue renewals")
  if (data.overdue_renewals.count === 0) {
    console.log(dim("  None"))
  } else {
    console.log(`  ${bold(String(data.overdue_renewals.count))} subscription(s) need cron attention:\n`)
    for (const r of data.overdue_renewals.items) {
      const actionColor = r.cron_will === "CHARGE" ? green : r.cron_will === "CANCEL" ? red : yellow
      console.log(`  [${r.subscription_id}] ${bold(r.name)} ${dim(`user:${r.user_id}`)}`)
      console.log(`       Amount: ${r.amount}  Overdue: ${yellow(r.overdue_by)}  Cron: ${actionColor(r.cron_will)}`)
      if (r.flags?.length) console.log(`       Flags: ${r.flags.join(", ")}`)
    }
  }

  section("Trials")
  console.log(`  Expired:          ${bold(String(data.trials.expired.count))}`)
  console.log(`  Expiring in 10d:  ${bold(String(data.trials.expiring_in_10d.count))}`)

  section("Recent failures (last 24h)")
  if (data.recent_failures_24h.count === 0) {
    console.log(dim("  None"))
  } else {
    for (const t of data.recent_failures_24h.items) {
      console.log(`  ${red("✗")} [tx:${t.transaction_id}] user:${t.user_id} ${t.amount}  ${dim(t.memo ?? "")}`)
    }
  }

  section("Recent webhooks")
  if (data.recent_webhooks.length === 0) {
    console.log(dim("  None"))
  } else {
    for (const w of data.recent_webhooks) {
      console.log(`  ${dim(new Date(w.createdAt).toLocaleString())}  ${w.memo}`)
    }
  }

  console.log()
}

async function cmdState(userId: string) {
  header(`User State — ID ${userId}`)
  const data = await api("GET", `/state/${userId}`)

  section("User")
  kv("user_id", data.user.user_id, 2)
  kv("email", data.user.email, 2)
  kv("name", data.user.name, 2)
  kv("role", data.user.role, 2)
  kv("is_premium", data.user.is_premium, 2)
  kv("active", data.user.active, 2)

  section("Card")
  if (!data.card) {
    console.log(dim("  No card on file"))
  } else {
    console.log(`  ${green(data.card.display)}  ${dim(`(${data.card.environment})`)}`)
  }

  section("Subscriptions")
  if (data.subscriptions.length === 0) {
    console.log(dim("  None"))
  } else {
    for (const sub of data.subscriptions) {
      const statusColor = sub.status === "active" ? green : sub.status === "trial" ? cyan : sub.status === "paused" ? yellow : red
      console.log(`  [${sub.subscription_id}] ${bold(sub.subscription_name)}`)
      console.log(`       Status:      ${statusColor(sub.status)}`)
      console.log(`       Amount:      ${sub.amount_formatted}`)
      console.log(`       Duration:    ${sub.duration}`)
      console.log(`       Renewal:     ${sub.renewal_date} ${dim(`(${sub.renewal_in})`)}`)
      if (sub.payment_failure_count > 0) {
        const countColor = sub.payment_failure_count >= 3 ? red : yellow
        console.log(`       Failures:    ${countColor(`${sub.payment_failure_count} / 4 max`)}`)
      }
      if (sub.next_renewal_attempt) {
        console.log(`       Next retry:  ${yellow(String(sub.next_renewal_attempt))}`)
      }
      if (sub.flags?.length) {
        console.log(`       Flags:       ${red(sub.flags.join(", "))}`)
      }
      if (sub.suspension_date) {
        console.log(`       Suspended:   ${yellow(String(sub.suspension_date))}`)
      }
      console.log(`       Environment: ${sub.square_environment ?? "production"}`)
      console.log()
    }
  }

  section("Transactions (last 25)")
  if (data.transactions.length === 0) {
    console.log(dim("  None"))
  } else {
    for (const tx of data.transactions) {
      const statusColor = tx.status === "completed" ? green : tx.status === "failed" ? red : yellow
      const time = dim(new Date(tx.createdAt).toLocaleString())
      console.log(`  ${time}  ${tx.type.padEnd(12)}  ${statusColor(tx.status?.padEnd(10) ?? "")}  ${tx.amount_formatted.padEnd(10)}  ${dim(tx.memo ?? "")}`)
    }
  }

  console.log()
}

async function cmdScenario(scenario: string, options: { email?: string; product?: string }) {
  header(`Creating scenario: ${scenario}${options.product ? ` [${options.product}]` : ""}`)
  const body: Record<string, unknown> = { scenario }
  if (options.email) body.email = options.email
  if (options.product) body.product = options.product
  const data = await api("POST", "/scenarios", body)

  console.log(green("\n✓ Scenario created\n"))
  kv("Scenario", data.scenario, 2)
  kv("Product type", data.product_type, 2)
  kv("User ID", data.user_id, 2)
  kv("Email", data.email, 2)
  kv("Subscription ID", data.subscription_id, 2)

  if (data.password) {
    kv("Password", data.password, 2)
  }

  if (data.card) {
    kv("Card", `${data.card.card_brand} ****${data.card.last_4}`, 2)
  } else {
    console.log(`  ${yellow("⚠  No sandbox card created (check Square sandbox credentials)")}`)
  }

  section("Description")
  console.log(`  ${data.description}`)

  section("Next steps")
  console.log(`  ${yellow(data.next_steps)}`)

  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${data.user_id}`)}`)
  console.log(`  ${dim("→")} ${cyan(`yarn dev:tools set-password ${data.user_id} <new_password>`)}`)
  console.log(`  ${dim("→")} ${cyan(`yarn dev:tools cleanup ${data.user_id}`)}`)
  console.log()
}

async function cmdSetState(subId: string, pairs: string[]) {
  const patch: Record<string, any> = {}
  for (const pair of pairs) {
    const eq = pair.indexOf("=")
    if (eq === -1) { console.error(red(`Invalid pair: ${pair}  (expected field=value)`)); process.exit(1) }
    const key = pair.slice(0, eq)
    const raw = pair.slice(eq + 1)

    if (key === "cancel_on_renewal" || key === "downgrade_on_renewal") {
      patch[key] = raw === "true"
    } else if (key === "amount" || key === "payment_failure_count") {
      patch[key] = parseInt(raw, 10)
    } else if (key === "next_renewal_attempt" && raw === "null") {
      patch[key] = null
    } else {
      patch[key] = raw
    }
  }

  header(`Set Subscription State — ID ${subId}`)
  const data = await api("POST", `/subscription/${subId}/set-state`, patch)

  console.log(green("\n✓ Updated\n"))
  kv("Status", data.status, 2)
  kv("Amount", data.amount_formatted, 2)
  kv("Renewal date", data.renewal_date, 2)
  kv("Renewal in", data.renewal_in, 2)
  kv("Next attempt", data.next_renewal_attempt ?? "null", 2)
  kv("cancel_on_renewal", data.cancel_on_renewal, 2)
  kv("downgrade_on_renewal", data.downgrade_on_renewal, 2)
  kv("Environment", data.square_environment, 2)
  console.log()
}

async function cmdCronPreview() {
  header("Cron Dry-Run Preview")
  const data = await api("GET", "/cron/preview")

  section("Summary")
  console.log(`  Total due:           ${bold(String(data.summary.total_due))}`)
  console.log(`  Will charge:         ${green(bold(String(data.summary.will_charge)))}`)
  console.log(`  Will cancel:         ${red(bold(String(data.summary.will_cancel)))}`)
  console.log(`  Will skip:           ${yellow(bold(String(data.summary.will_skip)))}`)
  console.log(`  Trials to expire:    ${bold(String(data.summary.trials_to_expire))}`)
  console.log(`  Trial warning emails:${bold(String(data.summary.trials_warning_email))}`)

  if (data.renewals.length > 0) {
    section("Subscriptions due")
    for (const r of data.renewals) {
      const actionColor = r.action === "CHARGE" ? green : r.action === "CANCEL" ? red : yellow
      console.log(`  [${r.subscription_id}] ${bold(r.name)}  ${dim(`user:${r.user_id}`)}`)
      console.log(`       Product:  ${r.product}`)
      console.log(`       Amount:   ${r.amount_formatted}  Overdue: ${yellow(r.overdue_by)}`)
      console.log(`       Action:   ${actionColor(r.action)}  — ${r.reason}`)
      if (r.next_renewal_attempt) {
        console.log(`       Retry at: ${r.next_renewal_attempt}`)
      }
      console.log()
    }
  }

  if (data.trial_expirations.length > 0) {
    section("Trial expirations")
    for (const t of data.trial_expirations) {
      console.log(`  [${t.subscription_id}] ${t.subscription_name}  ${dim(`user:${t.user_id}`)}  expired ${t.renewal_date}`)
    }
  }

  if (data.trial_warnings.length > 0) {
    section("Trial warning emails")
    for (const t of data.trial_warnings) {
      console.log(`  [${t.subscription_id}] ${t.subscription_name}  expires in ${yellow(String(t.days_remaining) + "d")}`)
    }
  }

  console.log()
}

async function cmdCronRun(userId: string, options: { email?: string }) {
  header(`Run Renewal — User ${userId}`)
  console.log(yellow("\n⚠  This triggers real payment logic. Ensure a sandbox card is on file.\n"))

  const data = await api("POST", `/cron/run-for-user/${userId}`, options.email ? { email: options.email } : {})

  console.log(green("✓ Renewal executed\n"))
  kv("Subscription ID", data.subscription_id, 2)
  kv("Email", data.email, 2)
  if (data.result) {
    console.log(`\n  ${dim("Result:")}`)
    console.log("  " + JSON.stringify(data.result, null, 2).split("\n").join("\n  "))
  }
  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${userId}`)}`)
  console.log()
}

async function cmdWebhook(type: string, userId: string) {
  header(`Fire Webhook — ${type} → user:${userId}`)
  const data = await api("POST", "/webhook/cashoffers", { type, userId: parseInt(userId, 10) })

  console.log(green("\n✓ Webhook processed\n"))
  kv("User", `${data.user.email} (${data.user.name})`, 2)
  kv("Signature", data.signature_header, 2)

  if (data.changes.length > 0) {
    section("Changes")
    for (const ch of data.changes) {
      console.log(`  [sub:${ch.subscription_id}] status: ${yellow(ch.status)}`)
    }
  } else {
    console.log(`\n  ${dim("No subscription status changes detected")}`)
  }

  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${userId}`)}`)
  console.log()
}

async function cmdCleanup(userId: string) {
  header(`Cleanup — User ${userId}`)
  const data = await api("DELETE", `/cleanup/${userId}`)

  console.log(green(`\n✓ Cleaned up user ${data.user_id} (${data.email})\n`))
  kv("Transactions deleted", data.deleted.transactions, 2)
  kv("Subscriptions deleted", data.deleted.subscriptions, 2)
  kv("Cards deleted", data.deleted.cards, 2)
  console.log()
}

async function cmdSetPassword(userId: string, password: string) {
  header(`Set Password — User ${userId}`)
  const data = await api("POST", `/user/${userId}/set-password`, { password })

  console.log(green("\n✓ Password updated\n"))
  kv("User ID", data.user_id, 2)
  kv("Email", data.email, 2)
  console.log(`\n  ${dim(data.message)}`)
  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${userId}`)}`)
  console.log()
}

async function cmdBreakCard(userId: string) {
  header(`Break Card — User ${userId}`)
  const data = await api("POST", `/card/${userId}/break`)

  console.log(red("\n✗ Card broken\n"))
  kv("User ID", data.user_id, 2)
  if (data.previous_card) {
    kv("Previous card", `${data.previous_card.card_brand} ****${data.previous_card.last_4}`, 2)
  }
  kv("Current card", `${data.current_card.card_brand} ****${data.current_card.last_4}`, 2)
  console.log(`\n  ${yellow(data.message)}`)
  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools cron-run ${userId}`)}  ${dim("(will fail)")}`)
  console.log(`  ${dim("→")} ${cyan(`yarn dev:tools fix-card ${userId}`)}   ${dim("(to restore)")}`)
  console.log()
}

async function cmdFixCard(userId: string) {
  header(`Fix Card — User ${userId}`)
  const data = await api("POST", `/card/${userId}/fix`)

  console.log(green("\n✓ Card restored\n"))
  kv("User ID", data.user_id, 2)
  kv("Card", `${data.card.card_brand} ****${data.card.last_4}`, 2)

  if (data.renewal_retries?.length > 0) {
    console.log(yellow(`\n  Retried ${data.renewal_retries.length} subscription(s):\n`))
    for (const r of data.renewal_retries) {
      const icon = r.result === "renewed" ? green("✓") : red("✗")
      console.log(`    ${icon} Sub #${r.subscription_id} (was ${r.status}) → ${r.result}`)
    }
  }

  console.log(`\n  ${green(data.message)}`)
  if (!data.renewal_retries?.length) {
    console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools cron-run ${userId}`)}  ${dim("(will succeed)")}`)
  }
  console.log()
}

async function cmdRefund(transactionId: string) {
  header(`Refund — Transaction ${transactionId}`)

  const data = await api("POST", `/refund/${transactionId}`)

  console.log(green("\n✓ Refund completed\n"))
  kv("User ID", data.user_id, 2)
  kv("Email", data.email, 2)

  section("Original Transaction")
  kv("Transaction ID", data.original_transaction.transaction_id, 4)
  kv("Square ID", data.original_transaction.square_transaction_id, 4)
  kv("Amount", data.original_transaction.amount_formatted, 4)
  kv("Type", data.original_transaction.type, 4)
  kv("Environment", data.original_transaction.environment, 4)

  section("Refund")
  kv("Refund ID", data.refund.refundId, 4)
  kv("Amount", `$${(data.refund.amount / 100).toFixed(2)}`, 4)
  kv("Status", green(data.refund.status), 4)

  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${data.user_id}`)}`)
  console.log()
}

async function cmdPropertyUnlock(propertyToken: string, options: { user: string }) {
  if (!options.user) {
    console.error(red("\n✗ --user <user_id> is required"))
    console.error(dim("  Example: yarn dev:tools property-unlock abc123 --user 42\n"))
    process.exit(1)
  }
  const userId = options.user

  header(`Property Unlock — Token: ${propertyToken}`)
  console.log(yellow("\n⚠  This charges $50 via sandbox test nonce (no card on file needed).\n"))

  const data = await api("POST", `/property-unlock/${propertyToken}`, { user_id: parseInt(userId, 10) })

  console.log(green("\n✓ Property unlocked\n"))
  kv("Property Token", data.property_token, 2)
  kv("Property Address", data.property_address, 2)
  kv("User ID", data.user_id, 2)
  kv("Email", data.email, 2)
  kv("Transaction ID", data.transaction_id, 2)
  kv("Square Payment ID", data.square_payment_id, 2)
  kv("Amount", data.amount_formatted, 2)
  kv("Card Nonce", dim(data.card_nonce), 2)
  kv("Environment", data.environment, 2)

  console.log(`\n  ${dim("→")} ${cyan(`yarn dev:tools state ${userId}`)}`)
  console.log(`  ${dim("→")} ${cyan(`yarn dev:tools refund ${userId}`)}  ${dim("(to test refunding this charge)")}`)
  console.log()
}

async function cmdVerify() {
  header("Product & Subscription Verification")
  const data = await api("GET", "/verify")

  section("Stats")
  kv("Products", data.stats.products, 2)
  kv("Active subscriptions", data.stats.subscriptions, 2)
  kv("HU subscriptions", data.stats.hu_subscriptions, 2)
  kv("Users checked", data.stats.users_checked, 2)

  section("Summary")
  const verdictColor = data.summary.verdict === "PASS" ? green : red
  kv("Verdict", verdictColor(data.summary.verdict), 2)
  kv("Errors", data.summary.errors === 0 ? green("0") : red(String(data.summary.errors)), 2)
  kv("Warnings", data.summary.warnings === 0 ? green("0") : yellow(String(data.summary.warnings)), 2)

  if (data.issues.length > 0) {
    section("Issues")
    for (const issue of data.issues) {
      const icon = issue.severity === "error" ? red("✗") : yellow("⚠")
      const label = `${issue.entity} #${issue.id}`
      console.log(`  ${icon} ${bold(label)}: ${issue.message}`)
    }
  } else {
    console.log(green("\n  ✓ All products and subscriptions are in good shape!\n"))
  }
}

async function cmdAuthLink(userId: string) {
  header(`Auth Link — User ${userId}`)
  const data = await api("GET", `/auth-link/${userId}`)

  console.log(green("\n✓ Auth link generated\n"))
  kv("User ID", data.user_id, 2)
  kv("Expires", data.expires_in, 2)
  console.log(`\n  ${bold("Manage URL:")}`)
  console.log(`  ${cyan(data.manage_url)}`)
  console.log(`\n  ${dim("Open this URL in a browser to log in as user " + userId)}`)
  console.log()
}

// ─── Query commands (BillingLogs, Subscriptions, Transactions, Users) ───────
//
// All responses are redacted server-side before leaving the /dev route handlers
// (SENSITIVE_KEY_REGEX in api/routes/dev/routes.ts), so the CLI can safely
// print metadata / data blobs verbatim. Do NOT add client-side display of any
// raw secret a user asks for — if it's not already redacted, the fix goes in
// the server, not here.

function levelColor(level: string) {
  return level === "error" ? red : level === "warn" ? yellow : level === "debug" ? gray : cyan
}

function formatMetadata(meta: unknown, indent = 8): string {
  if (meta == null) return ""
  try {
    const pretty = JSON.stringify(meta, null, 2)
    if (pretty === "{}" || pretty === "null") return ""
    const pad = " ".repeat(indent)
    return pretty.split("\n").map((l) => pad + l).join("\n")
  } catch {
    return ""
  }
}

async function cmdLogs(userIdArg: string | undefined, options: {
  level?: string
  component?: string
  contextType?: string
  requestId?: string
  search?: string
  since?: string
  limit?: string
}) {
  const params = new URLSearchParams()
  if (userIdArg) params.set("user_id", userIdArg)
  if (options.level) params.set("level", options.level)
  if (options.component) params.set("component", options.component)
  if (options.contextType) params.set("context_type", options.contextType)
  if (options.requestId) params.set("request_id", options.requestId)
  if (options.search) params.set("search", options.search)
  if (options.since) params.set("since", options.since)
  if (options.limit) params.set("limit", options.limit)

  const qs = params.toString()
  const data = await api("GET", `/logs${qs ? `?${qs}` : ""}`)

  header(`Billing Logs — ${data.count} result${data.count === 1 ? "" : "s"}`)

  if (data.count === 0) {
    console.log(dim("  No matching logs"))
    console.log()
    return
  }

  for (const log of data.logs) {
    const lc = levelColor(log.level)
    const time = dim(new Date(log.createdAt).toLocaleString())
    const levelTag = lc(log.level.toUpperCase().padEnd(5))
    const comp = log.component ? dim(`[${log.component}]`) : ""
    const user = log.user_id != null ? dim(`user:${log.user_id}`) : ""
    const req = log.request_id ? dim(`req:${String(log.request_id).slice(0, 8)}`) : ""

    console.log(`  ${time}  ${levelTag}  ${comp}  ${user}  ${req}`)
    console.log(`        log_id:${log.log_id}  ${bold(log.message)}`)

    const metaText = formatMetadata(log.metadata)
    if (metaText) console.log(gray(metaText))

    if (log.error_stack) {
      const stackFirst = String(log.error_stack).split("\n")[0]
      console.log(`        ${red("stack:")} ${dim(stackFirst)}`)
    }
    console.log()
  }

  console.log(dim(`  → yarn dev:tools log <log_id>                    (full detail)`))
  console.log(dim(`  → yarn dev:tools logs-request <request_id>       (trace one request)`))
  console.log()
}

async function cmdLog(logId: string) {
  header(`Log — ID ${logId}`)
  const log = await api("GET", `/logs/${logId}`)

  const lc = levelColor(log.level)
  kv("log_id", log.log_id, 2)
  kv("level", lc(log.level), 2)
  kv("component", log.component ?? "—", 2)
  kv("context_type", log.context_type, 2)
  kv("service", log.service ?? "—", 2)
  kv("user_id", log.user_id ?? "—", 2)
  kv("request_id", log.request_id ?? "—", 2)
  kv("createdAt", new Date(log.createdAt).toLocaleString(), 2)

  section("Message")
  console.log(`  ${bold(log.message)}`)

  if (log.metadata) {
    section("Metadata (sensitive keys redacted)")
    console.log(formatMetadata(log.metadata, 2))
  }

  if (log.error_stack) {
    section("Error stack")
    console.log(red(String(log.error_stack).split("\n").map((l: string) => "  " + l).join("\n")))
  }
  console.log()
}

async function cmdLogsRequest(requestId: string) {
  header(`Request Trace — ${requestId}`)
  const data = await api("GET", `/logs/request/${encodeURIComponent(requestId)}`)

  if (data.count === 0) {
    console.log(dim("  No logs found for that request_id"))
    console.log()
    return
  }

  console.log(dim(`  ${data.count} log entries, in time order\n`))

  for (const log of data.logs) {
    const lc = levelColor(log.level)
    const time = dim(new Date(log.createdAt).toLocaleTimeString())
    const levelTag = lc(log.level.toUpperCase().padEnd(5))
    const comp = log.component ? dim(`[${log.component}]`) : ""
    console.log(`  ${time}  ${levelTag}  ${comp}  ${log.message}`)
    const metaText = formatMetadata(log.metadata, 10)
    if (metaText) console.log(gray(metaText))
    if (log.error_stack) {
      const stackFirst = String(log.error_stack).split("\n")[0]
      console.log(`          ${red("stack:")} ${dim(stackFirst)}`)
    }
  }
  console.log()
}

async function cmdSubsQuery(userIdArg: string | undefined, options: {
  status?: string
  productId?: string
  overdue?: boolean
  failuresGte?: string
  limit?: string
}) {
  const params = new URLSearchParams()
  if (userIdArg) params.set("user_id", userIdArg)
  if (options.status) params.set("status", options.status)
  if (options.productId) params.set("product_id", options.productId)
  if (options.overdue) params.set("overdue", "true")
  if (options.failuresGte) params.set("failures_gte", options.failuresGte)
  if (options.limit) params.set("limit", options.limit)

  const qs = params.toString()
  const data = await api("GET", `/query/subscriptions${qs ? `?${qs}` : ""}`)

  header(`Subscriptions — ${data.count} result${data.count === 1 ? "" : "s"}`)

  if (data.count === 0) {
    console.log(dim("  No matching subscriptions"))
    console.log()
    return
  }

  for (const s of data.subscriptions) {
    const statusColor =
      s.status === "active" ? green :
      s.status === "trial" ? cyan :
      s.status === "paused" ? yellow : red

    console.log(`  [${s.subscription_id}] ${bold(s.subscription_name)}  ${dim(`user:${s.user_id}`)}`)
    console.log(`       Status:      ${statusColor(s.status ?? "null")}`)
    console.log(`       Product:     ${s.product_name ?? "—"}  (id:${s.product_id ?? "—"})`)
    console.log(`       Amount:      ${s.amount_formatted}  (${s.duration})`)
    console.log(`       Renewal:     ${s.renewal_date}  ${dim(`(${s.renewal_in})`)}`)
    if (s.payment_failure_count > 0) {
      const pc = s.payment_failure_count >= 3 ? red : yellow
      console.log(`       Failures:    ${pc(`${s.payment_failure_count} / 4`)}`)
    }
    if (s.next_renewal_attempt) console.log(`       Next retry:  ${yellow(String(s.next_renewal_attempt))}`)
    if (s.suspension_date) console.log(`       Suspended:   ${yellow(String(s.suspension_date))}`)
    const flags = [
      s.cancel_on_renewal ? "cancel_on_renewal" : null,
      s.downgrade_on_renewal ? "downgrade_on_renewal" : null,
    ].filter(Boolean)
    if (flags.length) console.log(`       Flags:       ${red(flags.join(", "))}`)
    console.log(`       Environment: ${s.square_environment ?? "production"}`)
    console.log()
  }
}

async function cmdTransactionsQuery(userIdArg: string | undefined, options: {
  status?: string
  type?: string
  since?: string
  limit?: string
}) {
  const params = new URLSearchParams()
  if (userIdArg) params.set("user_id", userIdArg)
  if (options.status) params.set("status", options.status)
  if (options.type) params.set("type", options.type)
  if (options.since) params.set("since", options.since)
  if (options.limit) params.set("limit", options.limit)

  const qs = params.toString()
  const data = await api("GET", `/query/transactions${qs ? `?${qs}` : ""}`)

  header(`Transactions — ${data.count} result${data.count === 1 ? "" : "s"}`)

  if (data.count === 0) {
    console.log(dim("  No matching transactions"))
    console.log()
    return
  }

  for (const t of data.transactions) {
    const statusColor =
      t.status === "completed" ? green :
      t.status === "failed" ? red : yellow
    const time = dim(new Date(t.createdAt).toLocaleString())
    console.log(
      `  ${time}  ${String(t.type).padEnd(12)}  ${statusColor(String(t.status ?? "").padEnd(10))}  ${t.amount_formatted.padEnd(10)}  ${dim(`tx:${t.transaction_id}`)}  ${dim(`user:${t.user_id ?? "—"}`)}`
    )
    if (t.memo) console.log(`        ${dim(t.memo)}`)
    if (t.square_transaction_id) console.log(`        ${dim(`square:${t.square_transaction_id}`)}`)
  }
  console.log()
}

function purchaseRequestStatusColor(status: string | null | undefined) {
  if (!status) return gray
  const s = String(status).toUpperCase()
  if (s === "COMPLETED") return green
  if (s === "FAILED") return red
  if (s === "RETRY_SCHEDULED") return yellow
  if (s === "PENDING") return cyan
  // In-progress states
  return yellow
}

async function cmdPurchaseRequests(userIdArg: string | undefined, options: {
  email?: string
  status?: string
  requestType?: string
  source?: string
  stuck?: boolean
  stuckMinutes?: string
  since?: string
  limit?: string
}) {
  const params = new URLSearchParams()
  if (userIdArg) params.set("user_id", userIdArg)
  if (options.email) params.set("email", options.email)
  if (options.status) params.set("status", options.status)
  if (options.requestType) params.set("request_type", options.requestType)
  if (options.source) params.set("source", options.source)
  if (options.stuck) params.set("stuck", "true")
  if (options.stuckMinutes) params.set("stuck_minutes", options.stuckMinutes)
  if (options.since) params.set("since", options.since)
  if (options.limit) params.set("limit", options.limit)

  const qs = params.toString()
  const data = await api("GET", `/query/purchase-requests${qs ? `?${qs}` : ""}`)

  header(`Purchase Requests — ${data.count} result${data.count === 1 ? "" : "s"}`)

  if (data.count === 0) {
    console.log(dim("  No matching purchase requests"))
    console.log()
    return
  }

  for (const r of data.purchase_requests) {
    const statusColor = purchaseRequestStatusColor(r.status)
    const time = dim(new Date(r.createdAt).toLocaleString())
    const stuckTag = r.is_stuck ? red(" [STUCK]") : ""

    console.log(`  ${time}  ${bold(`req:${r.request_id}`)}  ${statusColor(String(r.status ?? "").padEnd(22))}${stuckTag}`)
    console.log(`       Type:        ${r.request_type}  (source:${r.source ?? "—"})`)
    console.log(`       User/Email:  ${r.user_id ?? "—"}  ${dim(r.email)}`)
    console.log(`       Product:     ${r.product_name ?? "—"}  (id:${r.product_id})`)
    console.log(`       Charged:     ${r.amount_charged_formatted}${r.prorated_amount != null ? `  (prorated: ${r.prorated_amount_formatted})` : ""}`)
    if (r.retry_count > 0 || r.max_retries > 0) {
      const rc = r.retry_count >= r.max_retries ? red : yellow
      console.log(`       Retries:     ${rc(`${r.retry_count} / ${r.max_retries}`)}${r.next_retry_at ? `  next: ${yellow(new Date(r.next_retry_at).toLocaleString())}` : ""}`)
    }
    if (r.started_at) {
      const dur = r.processing_duration_ms != null ? `${r.processing_duration_ms}ms` : "—"
      console.log(`       Timing:      started:${dim(new Date(r.started_at).toLocaleString())}  duration:${dur}`)
    }
    if (r.subscription_id_result || r.transaction_id_result) {
      console.log(`       Results:     sub:${r.subscription_id_result ?? "—"}  tx:${r.transaction_id_result ?? "—"}`)
    }
    if (r.failure_reason) {
      console.log(`       ${red("Failure:")}     ${r.failure_reason}${r.error_code ? dim(`  [${r.error_code}]`) : ""}`)
    }
    console.log(dim(`       uuid:${r.request_uuid}`))
    console.log()
  }

  console.log(dim(`  → yarn dev:tools purchase-request <request_id>   (full detail)`))
  console.log()
}

async function cmdPurchaseRequest(requestId: string) {
  header(`Purchase Request — ${requestId}`)
  const r = await api("GET", `/query/purchase-request/${encodeURIComponent(requestId)}`)

  const statusColor = purchaseRequestStatusColor(r.status)
  kv("request_id", r.request_id, 2)
  kv("request_uuid", r.request_uuid, 2)
  kv("request_type", r.request_type, 2)
  kv("source", r.source ?? "—", 2)
  kv("status", statusColor(r.status ?? "—"), 2)
  kv("user_id", r.user_id ?? "—", 2)
  kv("email", r.email, 2)
  kv("product", `${r.product_name ?? "—"} (id:${r.product_id})`, 2)
  kv("subscription_id", r.subscription_id ?? "—", 2)
  kv("idempotency_key", r.idempotency_key ?? "—", 2)
  kv("user_created", r.user_created, 2)
  kv("createdAt", new Date(r.createdAt).toLocaleString(), 2)
  kv("updatedAt", new Date(r.updatedAt).toLocaleString(), 2)

  section("Timing")
  kv("started_at", r.started_at ? new Date(r.started_at).toLocaleString() : "—", 2)
  kv("completed_at", r.completed_at ? new Date(r.completed_at).toLocaleString() : "—", 2)
  kv("processing_duration_ms", r.processing_duration_ms ?? "—", 2)

  section("Retries")
  kv("retry_count", r.retry_count, 2)
  kv("max_retries", r.max_retries, 2)
  kv("next_retry_at", r.next_retry_at ? new Date(r.next_retry_at).toLocaleString() : "—", 2)

  section("Results")
  kv("subscription_id_result", r.subscription_id_result ?? "—", 2)
  kv("transaction_id_result", r.transaction_id_result ?? "—", 2)
  kv("amount_charged", r.amount_charged_formatted, 2)
  kv("card_id_result", r.card_id_result ?? "—", 2)
  kv("prorated_amount", r.prorated_amount_formatted, 2)

  if (r.failure_reason || r.error_code) {
    section("Failure")
    kv("error_code", r.error_code ?? "—", 2)
    if (r.failure_reason) console.log(`  ${red("reason:")}\n  ${r.failure_reason}`)
  }

  section("Request data (sensitive keys redacted)")
  console.log(formatMetadata(r.request_data, 2))
  console.log()
}

async function cmdFindUser(email: string, options: { limit?: string }) {
  const params = new URLSearchParams({ email })
  if (options.limit) params.set("limit", options.limit)

  const data = await api("GET", `/query/find-user?${params.toString()}`)

  header(`Find User — "${email}" — ${data.count} match${data.count === 1 ? "" : "es"}`)

  if (data.count === 0) {
    console.log(dim("  No users match that email"))
    console.log()
    return
  }

  for (const u of data.users) {
    console.log(`  [${u.user_id}] ${bold(u.email)}  ${dim(u.name ?? "")}`)
    console.log(`       role:${u.role}  is_premium:${u.is_premium}  active:${u.active}  whitelabel:${u.whitelabel_id}`)
    console.log(`       created: ${dim(new Date(u.created).toLocaleString())}`)
    console.log(`       ${dim("→")} ${cyan(`yarn dev:tools state ${u.user_id}`)}`)
    console.log()
  }
}

// ─── CLI Definition ───────────────────────────────────────────────────────────

const program = new Command()

program
  .name("dev-tools")
  .description("CashOffers Billing — Developer CLI (server must be running on localhost:3000)")
  .version("1.0.0")

program
  .command("system")
  .description("System overview: counts, failures, pending renewals")
  .action(cmdSystem)

program
  .command("state <user_id>")
  .description("Full user state: subscriptions, card, transactions")
  .action(cmdState)

program
  .command("scenario <name>")
  .description("Create a named test scenario")
  .addHelpText("after", `
Scenarios:
  renewal-due            Active sub overdue → cron will charge
  payment-failure        Active sub overdue with BROKEN card → cron will fail
  payment-retry-1        1 prior failure (payment_failure_count=1), retry overdue → break-card then cron-run
  payment-retry-2        2 prior failures (count=2), second retry window
  payment-retry-3        3 prior failures (count=3) → next failure auto-suspends
  trial-expiring         Trial expiring in 9 days → cron sends warning
  trial-expired          Trial past expiry → cron converts (P-TRIAL) or cancels
  cancel-on-renewal      Marked for cancel → cron cancels, not charges
  downgrade-on-renewal   cancel_on_renewal + whitelabel=2 (DOWNGRADE_TO_FREE)
  paused                 Subscription in paused state (CO deactivated)
  suspended              Suspended after max retries (count=4), BROKEN card → fix-card to reactivate
  premium-no-sub         Premium user (is_premium=1) with NO subscription → test manage enrollment

Product types (--product flag):
  p-co                   Default. CO Premium: managed=true, role=AGENT, is_premium=1
  p-hu                   HU Standalone: managed=false, role=AGENT, is_premium=0 (CO external)
  p-trial                HU Free Trial: managed=true, role=HOMEUPTICK, is_premium=0 (CO=HOMEUPTICK)`)
  .option("-e, --email <email>", "Email address for the test user")
  .option("-p, --product <type>", "Product type: p-co (default), p-hu, p-trial")
  .action(cmdScenario)

program
  .command("set-state <sub_id> [fields...]")
  .description("Patch subscription fields directly (field=value pairs)")
  .addHelpText("after", `
Fields:
  renewal_date=<ISO>           e.g. renewal_date=2025-01-01T00:00:00Z
  next_renewal_attempt=<ISO>   or next_renewal_attempt=null to clear
  cancel_on_renewal=true|false
  downgrade_on_renewal=true|false
  status=active|trial|paused|cancelled|suspended
  payment_failure_count=<0-4>  e.g. payment_failure_count=3
  square_environment=production|sandbox
  amount=<cents>               e.g. amount=25000`)
  .action(cmdSetState)

program
  .command("cron-preview")
  .description("Dry-run: what would cron do right now?")
  .action(cmdCronPreview)

program
  .command("cron-run <user_id>")
  .description("Run renewal logic for one user (triggers real payment logic)")
  .option("-e, --email <email>", "Override email address")
  .action(cmdCronRun)

program
  .command("webhook <type> <user_id>")
  .description("Fire a CashOffers webhook event")
  .addHelpText("after", `
Types:
  user.deactivated   user.activated   user.created`)
  .action((type, userId) => {
    const validTypes = ["user.deactivated", "user.activated", "user.created"]
    if (!validTypes.includes(type)) {
      console.error(red(`Unknown webhook type: ${type}`))
      console.error(dim(`Valid types: ${validTypes.join(", ")}`))
      process.exit(1)
    }
    return cmdWebhook(type, userId)
  })

program
  .command("cleanup <user_id>")
  .description("Delete user and all associated data (transactions, subscriptions, cards)")
  .action(cmdCleanup)

program
  .command("set-password <user_id> <password>")
  .description("Set password for a user (for testing manage flows)")
  .action(cmdSetPassword)

program
  .command("break-card <user_id>")
  .description("Replace user's card with an invalid one (forces payment failures)")
  .action(cmdBreakCard)

program
  .command("fix-card <user_id>")
  .description("Restore user's card with a valid sandbox card (payments will succeed)")
  .action(cmdFixCard)

program
  .command("refund <transaction_id>")
  .description("Refund a transaction by its internal transaction ID")
  .action(cmdRefund)

program
  .command("property-unlock <property_token>")
  .description("Test property unlock flow — charges $50 on user's sandbox card")
  .requiredOption("-u, --user <user_id>", "User ID to charge")
  .action(cmdPropertyUnlock)

program
  .command("verify")
  .description("Verify all products and subscriptions match expected configuration")
  .action(cmdVerify)

program
  .command("auth-link <user_id>")
  .description("Generate a valid auth link for the /manage routes (30-day expiry)")
  .action(cmdAuthLink)

// ─── Query commands (debugging billing data) ─────────────────────────────────

program
  .command("logs [user_id]")
  .description("Query billinglogs table (sensitive keys are redacted server-side)")
  .addHelpText("after", `
Options are AND-ed together. Omit user_id to search across all users.

Examples:
  yarn dev:tools logs 42
  yarn dev:tools logs --level error --since 24
  yarn dev:tools logs --component payment-processor --limit 100
  yarn dev:tools logs --request-id abc-123
  yarn dev:tools logs --search "renewal failed" --since 72`)
  .option("--level <level>", "Filter by level: debug, info, warn, error")
  .option("--component <name>", "Filter by component (e.g. payment-processor)")
  .option("--context-type <type>", "http_request | cron_job | event_handler | background")
  .option("--request-id <id>", "Filter by request_id")
  .option("--search <text>", "Case-sensitive LIKE search on message")
  .option("--since <hours>", "Only logs from the last N hours")
  .option("--limit <n>", "Max rows (default 50, max 500)")
  .action(cmdLogs)

program
  .command("log <log_id>")
  .description("Show a single billing log entry with full metadata and stack")
  .action(cmdLog)

program
  .command("logs-request <request_id>")
  .description("Show all billing logs for one request_id (full trace, time-ordered)")
  .action(cmdLogsRequest)

program
  .command("subs [user_id]")
  .description("Query Subscriptions table with filters")
  .addHelpText("after", `
Examples:
  yarn dev:tools subs 42
  yarn dev:tools subs --status suspended
  yarn dev:tools subs --overdue
  yarn dev:tools subs --failures-gte 2 --limit 20`)
  .option("--status <status>", "active | trial | paused | cancelled | suspended | expired | inactive | disabled")
  .option("--product-id <id>", "Filter by product_id")
  .option("--overdue", "Active subscriptions with renewal_date in the past")
  .option("--failures-gte <n>", "Subscriptions with payment_failure_count >= N")
  .option("--limit <n>", "Max rows (default 50, max 500)")
  .action(cmdSubsQuery)

program
  .command("transactions [user_id]")
  .description("Query Transactions table with filters")
  .addHelpText("after", `
Examples:
  yarn dev:tools transactions 42
  yarn dev:tools transactions --status failed --since 24
  yarn dev:tools transactions --type charge --limit 100
  yarn dev:tools transactions --type webhook`)
  .option("--status <status>", "completed | failed | pending (depends on type)")
  .option("--type <type>", "charge | refund | webhook")
  .option("--since <hours>", "Only transactions from the last N hours")
  .option("--limit <n>", "Max rows (default 50, max 500)")
  .action(cmdTransactionsQuery)

program
  .command("purchase-requests [user_id]")
  .description("Query PurchaseRequests table (every purchase attempt, with status transitions)")
  .addHelpText("after", `
Critical for spotting purchases that failed mid-flow — the PurchaseRequests
table records every attempt at a new purchase, renewal, or upgrade with a
granular status. A row stuck in an in-progress status (PENDING, VALIDATING,
PROCESSING_PAYMENT, CREATING_SUBSCRIPTION, FINALIZING) means the system lost
track of it: crash, unhandled exception, deploy interruption, etc. Use --stuck
to surface exactly those rows.

Statuses:
  PENDING   VALIDATING   PROCESSING_PAYMENT   CREATING_SUBSCRIPTION
  FINALIZING   COMPLETED   FAILED   RETRY_SCHEDULED

Request types:   NEW_PURCHASE | RENEWAL | UPGRADE
Sources:         API | CRON | ADMIN

Examples:
  yarn dev:tools purchase-requests 42
  yarn dev:tools purchase-requests --status FAILED --since 24
  yarn dev:tools purchase-requests --stuck
  yarn dev:tools purchase-requests --stuck --stuck-minutes 15
  yarn dev:tools purchase-requests --type RENEWAL --source CRON --since 168
  yarn dev:tools purchase-requests --email @acme.com`)
  .option("--email <email>", "Filter by email substring (LIKE %email%)")
  .option("--status <status>", "PENDING | VALIDATING | PROCESSING_PAYMENT | CREATING_SUBSCRIPTION | FINALIZING | COMPLETED | FAILED | RETRY_SCHEDULED")
  .option("--type <type>", "NEW_PURCHASE | RENEWAL | UPGRADE", (v) => v)
  .option("--source <source>", "API | CRON | ADMIN")
  .option("--stuck", "Non-terminal requests older than --stuck-minutes (default 5) — likely failed mid-flow")
  .option("--stuck-minutes <n>", "Minutes threshold for --stuck (default 5)")
  .option("--since <hours>", "Only requests from the last N hours")
  .option("--limit <n>", "Max rows (default 50, max 500)")
  .action((userId, opts) =>
    cmdPurchaseRequests(userId, { ...opts, requestType: opts.type })
  )

program
  .command("purchase-request <request_id>")
  .description("Show a single purchase request with full detail (accepts request_id or request_uuid)")
  .action(cmdPurchaseRequest)

program
  .command("find-user <email>")
  .description("Find users by email substring (LIKE %email%)")
  .option("--limit <n>", "Max rows (default 20, max 100)")
  .action(cmdFindUser)

// ─── env subcommand group ─────────────────────────────────────────────────────

const envCmd = program
  .command("env")
  .description("Manage encrypted environment secrets")

function spawnEnvScript(script: string, args: string[] = []) {
  const scriptPath = path.join(__dirname, "env", script)
  const result = spawnSync("npx", ["tsx", scriptPath, ...args], { stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

envCmd
  .command("setup")
  .description("First-time setup: retrieve key from Keeper, write to shell profile")
  .option("--env <environment>", "Target environment (development, staging, production)", "development")
  .action((opts) => spawnEnvScript("setup.ts", ["--env", opts.env]))

envCmd
  .command("edit")
  .description("Interactive TUI: add, edit, or delete secrets")
  .option("--env <environment>", "Target environment (development, staging, production)", "development")
  .action((opts) => spawnEnvScript("edit.tsx", ["--env", opts.env]))

envCmd
  .command("rotate")
  .description("Rotate encryption keys with guided post-rotation checklist")
  .option("--env <environment>", "Target environment (development, staging, production)", "development")
  .action((opts) => spawnEnvScript("rotate.tsx", ["--env", opts.env]))

envCmd
  .command("decrypt")
  .description("Decrypt env file to plaintext for bulk editing (re-encrypt when done)")
  .option("--env <environment>", "Target environment (development, staging, production)", "development")
  .action((opts) => spawnEnvScript("decrypt.ts", ["--env", opts.env]))

envCmd
  .command("encrypt")
  .description("Re-encrypt env file after bulk editing")
  .option("--env <environment>", "Target environment (development, staging, production)", "development")
  .action((opts) => spawnEnvScript("encrypt.ts", ["--env", opts.env]))

program.parseAsync(process.argv)
