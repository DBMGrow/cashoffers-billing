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
  p-trial                HU Free Trial: managed=true, role=SHELL, is_premium=0 (CO=SHELL)`)
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
