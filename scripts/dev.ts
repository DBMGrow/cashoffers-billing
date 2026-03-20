#!/usr/bin/env tsx
/**
 * Dev CLI — CashOffers Billing Developer Tools
 *
 * Usage (server must be running on localhost:3000):
 *
 *   tsx scripts/dev.ts system                              — System overview
 *   tsx scripts/dev.ts state <user_id>                    — Full user state dump
 *   tsx scripts/dev.ts scenario <name> [email]            — Create a test scenario
 *   tsx scripts/dev.ts set-state <sub_id> [field=value…]  — Patch subscription fields
 *   tsx scripts/dev.ts cron-preview                       — What would cron do?
 *   tsx scripts/dev.ts cron-run <user_id> [email]         — Run renewal for one user
 *   tsx scripts/dev.ts webhook <type> <user_id>           — Fire a CashOffers webhook
 *   tsx scripts/dev.ts cleanup <user_id>                  — Delete user and all related data
 *   tsx scripts/dev.ts help                               — Show this message
 *
 * Scenarios:
 *   renewal-due         Active sub with renewal_date in the past → cron will charge
 *   payment-retry-1     Failed once, next_renewal_attempt overdue → cron will retry
 *   payment-retry-2     Failed twice, simulating second retry window
 *   trial-expiring      Trial expiring in 9 days → cron sends warning email
 *   trial-expired       Trial past expiry → cron cancels it
 *   cancel-on-renewal   cancel_on_renewal=true → cron cancels, not charges
 *   downgrade-on-renewal downgrade_on_renewal=true → cron skips
 *   paused              Subscription in paused state
 *
 * set-state fields:
 *   renewal_date=<ISO>           e.g. 2025-01-01T00:00:00Z
 *   next_renewal_attempt=<ISO>   or next_renewal_attempt=null to clear
 *   cancel_on_renewal=true|false
 *   downgrade_on_renewal=true|false
 *   status=active|trial|paused|cancelled
 *   square_environment=production|sandbox
 *   amount=<cents>               e.g. amount=25000
 *
 * Webhook types:
 *   user.deactivated    user.activated    user.created
 */

import "dotenv/config"

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
  white: "\x1b[37m",
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
    console.error(dim("  Make sure the dev server is running: npm run dev"))
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
  if (!userId) { console.error(red("Usage: state <user_id>")); process.exit(1) }
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
    console.log(`  ${green(data.card.display)}  ${dim(`(${data.card.environment})`)}`);
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

async function cmdScenario(scenario: string, email?: string) {
  if (!scenario) {
    console.error(red("Usage: scenario <name> [email]"))
    console.error(dim("Available: renewal-due, payment-retry-1, payment-retry-2, trial-expiring, trial-expired, cancel-on-renewal, downgrade-on-renewal, paused"))
    process.exit(1)
  }

  header(`Creating scenario: ${scenario}`)
  const data = await api("POST", "/scenarios", { scenario, email })

  console.log(green("\n✓ Scenario created\n"))
  kv("Scenario", data.scenario, 2)
  kv("User ID", data.user_id, 2)
  kv("Email", data.email, 2)
  kv("Subscription ID", data.subscription_id, 2)

  section("Description")
  console.log(`  ${data.description}`)

  section("Next steps")
  console.log(`  ${yellow(data.next_steps)}`)

  console.log(`\n  ${dim("→")} ${cyan(`tsx scripts/dev.ts state ${data.user_id}`)}`)
  console.log(`  ${dim("→")} ${cyan(`tsx scripts/dev.ts cleanup ${data.user_id}`)}`)
  console.log()
}

async function cmdSetState(subId: string, pairs: string[]) {
  if (!subId || pairs.length === 0) {
    console.error(red("Usage: set-state <sub_id> [field=value…]"))
    console.error(dim("Fields: renewal_date, next_renewal_attempt, cancel_on_renewal, downgrade_on_renewal, status, square_environment, amount"))
    process.exit(1)
  }

  const patch: Record<string, any> = {}
  for (const pair of pairs) {
    const eq = pair.indexOf("=")
    if (eq === -1) { console.error(red(`Invalid pair: ${pair}  (expected field=value)`)); process.exit(1) }
    const key = pair.slice(0, eq)
    const raw = pair.slice(eq + 1)

    if (key === "cancel_on_renewal" || key === "downgrade_on_renewal") {
      patch[key] = raw === "true"
    } else if (key === "amount") {
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

async function cmdCronRun(userId: string, email?: string) {
  if (!userId) { console.error(red("Usage: cron-run <user_id> [email]")); process.exit(1) }
  header(`Run Renewal — User ${userId}`)
  console.log(yellow("\n⚠  This triggers real payment logic. Ensure a sandbox card is on file.\n"))

  const data = await api("POST", `/cron/run-for-user/${userId}`, email ? { email } : {})

  console.log(green("✓ Renewal executed\n"))
  kv("Subscription ID", data.subscription_id, 2)
  kv("Email", data.email, 2)
  if (data.result) {
    console.log(`\n  ${dim("Result:")}`)
    console.log("  " + JSON.stringify(data.result, null, 2).split("\n").join("\n  "))
  }
  console.log(`\n  ${dim("→")} ${cyan(`tsx scripts/dev.ts state ${userId}`)}`)
  console.log()
}

async function cmdWebhook(type: string, userId: string) {
  const validTypes = ["user.deactivated", "user.activated", "user.created"]
  if (!type || !userId) {
    console.error(red(`Usage: webhook <type> <user_id>`))
    console.error(dim(`Types: ${validTypes.join(", ")}`))
    process.exit(1)
  }
  if (!validTypes.includes(type)) {
    console.error(red(`Unknown type: ${type}`))
    console.error(dim(`Valid: ${validTypes.join(", ")}`))
    process.exit(1)
  }

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

  console.log(`\n  ${dim("→")} ${cyan(`tsx scripts/dev.ts state ${userId}`)}`)
  console.log()
}

async function cmdCleanup(userId: string) {
  if (!userId) { console.error(red("Usage: cleanup <user_id>")); process.exit(1) }
  header(`Cleanup — User ${userId}`)
  const data = await api("DELETE", `/cleanup/${userId}`)

  console.log(green(`\n✓ Cleaned up user ${data.user_id} (${data.email})\n`))
  kv("Transactions deleted", data.deleted.transactions, 2)
  kv("Subscriptions deleted", data.deleted.subscriptions, 2)
  kv("Cards deleted", data.deleted.cards, 2)
  console.log()
}

function cmdHelp() {
  console.log(`
${bold("CashOffers Billing — Dev CLI")}
${dim("Server must be running on localhost:3000")}

${bold("Commands:")}
  ${cyan("system")}                              System overview (counts, failures, pending renewals)
  ${cyan("state")} <user_id>                    Full user state: subscriptions, card, transactions
  ${cyan("scenario")} <name> [email]            Create a named test scenario
  ${cyan("set-state")} <sub_id> [field=value…]  Patch subscription fields directly
  ${cyan("cron-preview")}                        What would cron do right now? (dry-run)
  ${cyan("cron-run")} <user_id> [email]         Run renewal logic for one user (triggers payment)
  ${cyan("webhook")} <type> <user_id>           Fire a CashOffers webhook event
  ${cyan("cleanup")} <user_id>                  Delete user and all associated data
  ${cyan("help")}                               Show this message

${bold("Scenarios:")}
  renewal-due            Active sub overdue → cron will charge
  payment-retry-1        Failed once, retry overdue → cron will retry
  payment-retry-2        Failed twice, second retry window
  trial-expiring         Trial expiring in 9 days → cron sends warning
  trial-expired          Trial past expiry → cron cancels
  cancel-on-renewal      Marked for cancel → cron cancels, not charges
  downgrade-on-renewal   Marked for downgrade → cron skips
  paused                 Subscription in paused state

${bold("set-state fields:")}
  renewal_date=<ISO>           e.g. renewal_date=2025-01-01T00:00:00Z
  next_renewal_attempt=<ISO>   or next_renewal_attempt=null to clear
  cancel_on_renewal=true|false
  downgrade_on_renewal=true|false
  status=active|trial|paused|cancelled
  square_environment=production|sandbox
  amount=<cents>               e.g. amount=25000

${bold("Webhook types:")}
  user.deactivated   user.activated   user.created

${bold("Examples:")}
  tsx scripts/dev.ts system
  tsx scripts/dev.ts scenario renewal-due alice@test.com
  tsx scripts/dev.ts cron-preview
  tsx scripts/dev.ts cron-run 42
  tsx scripts/dev.ts set-state 7 renewal_date=2025-01-01T00:00:00Z next_renewal_attempt=null
  tsx scripts/dev.ts webhook user.deactivated 42
  tsx scripts/dev.ts state 42
  tsx scripts/dev.ts cleanup 42
`)
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

;(async () => {
  const [, , cmd, ...args] = process.argv

  switch (cmd) {
    case "system":         await cmdSystem(); break
    case "state":          await cmdState(args[0]); break
    case "scenario":       await cmdScenario(args[0], args[1]); break
    case "set-state":      await cmdSetState(args[0], args.slice(1)); break
    case "cron-preview":   await cmdCronPreview(); break
    case "cron-run":       await cmdCronRun(args[0], args[1]); break
    case "webhook":        await cmdWebhook(args[0], args[1]); break
    case "cleanup":        await cmdCleanup(args[0]); break
    case "help":
    case "--help":
    case "-h":
    case undefined:        cmdHelp(); break
    default:
      console.error(red(`Unknown command: ${cmd}`))
      console.error(dim("Run 'tsx scripts/dev.ts help' for usage"))
      process.exit(1)
  }
})()
