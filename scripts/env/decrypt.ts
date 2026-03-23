#!/usr/bin/env tsx
/**
 * env decrypt — Decrypt an env file to plaintext for bulk editing
 *
 * Writes plaintext values back into the env file so you can bulk-edit with
 * any text editor. Re-encrypt with `yarn dev:tools env encrypt` when done.
 *
 * ⚠  The decrypted file MUST NOT be committed to git.
 *
 * Usage:
 *   yarn dev:tools env decrypt                   # development (default)
 *   yarn dev:tools env decrypt --env staging
 *   yarn dev:tools env decrypt --env production  # requires confirmation
 */

import { execSync } from "child_process"
import * as readline from "readline"

// ─── Config ───────────────────────────────────────────────────────────────────

const ENV_FILE_MAP: Record<string, string> = {
  development: ".env.development",
  staging: ".env.staging",
  production: ".env.production",
}

const KEY_NAME_MAP: Record<string, string> = {
  development: "DOTENV_PRIVATE_KEY_DEVELOPMENT",
  staging: "DOTENV_PRIVATE_KEY_STAGING",
  production: "DOTENV_PRIVATE_KEY_PRODUCTION",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hr = "─".repeat(60)

function warn(lines: string[]) {
  const width = 60
  const border = `\x1b[1m\x1b[43m\x1b[30m ${"!".repeat(width - 2)} \x1b[0m`
  const blank = `\x1b[1m\x1b[43m\x1b[30m ${" ".repeat(width - 2)} \x1b[0m`
  console.log(border)
  console.log(blank)
  for (const line of lines) {
    const padded = line.padEnd(width - 2)
    console.log(`\x1b[1m\x1b[43m\x1b[30m ${padded} \x1b[0m`)
  }
  console.log(blank)
  console.log(border)
}

function isEncrypted(file: string): boolean {
  try {
    const content = execSync(`cat ${file}`, { stdio: ["pipe", "pipe", "pipe"] }).toString()
    return content.includes("encrypted:")
  } catch {
    return false
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runDecrypt(envName: string): Promise<void> {
  console.log(`\n\x1b[1m\x1b[34m${hr}\x1b[0m`)
  console.log(`\x1b[1m\x1b[34m  CashOffers Billing — env decrypt\x1b[0m`)
  console.log(`\x1b[1m\x1b[34m${hr}\x1b[0m\n`)

  const keyName = KEY_NAME_MAP[envName]
  const file = ENV_FILE_MAP[envName]
  const envColor = envName === "production" ? "\x1b[31m" : envName === "staging" ? "\x1b[33m" : "\x1b[32m"

  console.log(`Target: ${envColor}\x1b[1m${file}\x1b[0m\n`)

  if (!process.env[keyName]) {
    console.error(`\x1b[31m✗ ${keyName} is not set.\x1b[0m`)
    console.error(`  Run: yarn dev:tools env setup --env ${envName}\n`)
    process.exit(1)
  }

  if (!isEncrypted(file)) {
    console.log(`\x1b[33m⚠  ${file} does not appear to be encrypted (no "encrypted:" values found).\x1b[0m`)
    console.log(`   It may already be decrypted, or the file may be empty.\n`)
    console.log(`   If you've finished bulk editing, run:`)
    console.log(`   \x1b[36m  yarn dev:tools env encrypt --env ${envName}\x1b[0m\n`)
    process.exit(0)
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve))

  // Production requires extra confirmation
  if (envName === "production") {
    warn([
      "  ⚠  PRODUCTION ENVIRONMENT — EXTREME CAUTION  ⚠",
      "",
      "  Decrypting .env.production writes live credentials",
      "  as plaintext. Committing this file would expose",
      "  production secrets.",
    ])
    console.log()
    const answer = await ask(`Type "yes, decrypt production" to continue: `)
    rl.close()
    if (answer.trim() !== "yes, decrypt production") {
      console.log("\nAborted.\n")
      process.exit(0)
    }
    console.log()
  } else {
    warn([
      `  ⚠  DECRYPTING — DO NOT COMMIT THIS FILE  ⚠`,
      "",
      `  This will write plaintext secrets into ${file}.`,
      `  Re-encrypt before committing:`,
      `    yarn dev:tools env encrypt --env ${envName}`,
    ])
    console.log()
    const answer = await ask(`Type "yes" to decrypt: `)
    rl.close()
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("\nAborted.\n")
      process.exit(0)
    }
    console.log()
  }

  process.stdout.write(`Decrypting ${file}... `)
  try {
    execSync(`npx dotenvx decrypt -f ${file}`, {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (err: any) {
    console.log(`\x1b[31m✗\x1b[0m`)
    console.error(`\n\x1b[31mDecryption failed:\x1b[0m`)
    console.error(err?.stderr?.toString() ?? err?.message ?? String(err))
    process.exit(1)
  }
  console.log(`\x1b[32m✓\x1b[0m\n`)

  warn([
    `  ⚠  ${file} IS NOW DECRYPTED  ⚠`,
    "",
    `  DO NOT git add or commit this file in this state.`,
    `  Do not leave it decrypted when you are done.`,
  ])
  console.log()
  console.log(`  Edit the file, then re-encrypt:`)
  console.log(`  \x1b[36m  yarn dev:tools env encrypt --env ${envName}\x1b[0m\n`)
  console.log(`  Or use the interactive editor (no decrypt needed):`)
  console.log(`  \x1b[36m  yarn dev:tools env edit --env ${envName}\x1b[0m\n`)

  // Check git status as a safeguard hint
  try {
    const status = execSync(`git status --short ${file} 2>/dev/null`, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim()
    if (status) {
      console.log(`  Git status: \x1b[33m${status}\x1b[0m`)
      console.log(`  \x1b[33mThe file is modified in git — be careful not to stage it.\x1b[0m\n`)
    }
  } catch {
    // git not available or file not tracked — no-op
  }
}

// Run when spawned directly
const envArg = process.argv.indexOf("--env")
const envName = envArg !== -1 ? (process.argv[envArg + 1] ?? "development") : "development"

const validEnvs = Object.keys(ENV_FILE_MAP)
if (!validEnvs.includes(envName)) {
  console.error(`Unknown environment: ${envName}`)
  console.error(`Valid: ${validEnvs.join(", ")}`)
  process.exit(1)
}

runDecrypt(envName).catch((err) => { console.error(err); process.exit(1) })
