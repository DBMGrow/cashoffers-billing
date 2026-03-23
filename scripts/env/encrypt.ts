#!/usr/bin/env tsx
/**
 * env encrypt — Re-encrypt a decrypted env file after bulk editing
 *
 * Encrypts plaintext values in the env file using the stored public key.
 * Run this after `yarn dev:tools env decrypt` when you are done editing.
 *
 * Usage:
 *   yarn dev:tools env encrypt                   # development (default)
 *   yarn dev:tools env encrypt --env staging
 *   yarn dev:tools env encrypt --env production
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

function hasPlaintextValues(file: string): boolean {
  try {
    const content = execSync(`cat ${file}`, { stdio: ["pipe", "pipe", "pipe"] }).toString()
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("DOTENV_PUBLIC_KEY")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx < 0) continue
      const value = trimmed.slice(eqIdx + 1)
      // A non-empty value that isn't encrypted and isn't quoted-empty is plaintext
      if (value && value !== '""' && value !== "''" && !value.startsWith('"encrypted:') && !value.startsWith("encrypted:")) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

function isGitStaged(file: string): boolean {
  try {
    const result = execSync(`git diff --cached --name-only 2>/dev/null`, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
    return result.split("\n").some((f) => f.trim() === file)
  } catch {
    return false
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runEncrypt(envName: string): Promise<void> {
  console.log(`\n\x1b[1m\x1b[34m${hr}\x1b[0m`)
  console.log(`\x1b[1m\x1b[34m  CashOffers Billing — env encrypt\x1b[0m`)
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

  // Guard: warn if the file is already fully encrypted
  if (isEncrypted(file) && !hasPlaintextValues(file)) {
    console.log(`\x1b[32m✓ ${file} is already fully encrypted.\x1b[0m`)
    console.log(`  Nothing to do. To edit secrets interactively:`)
    console.log(`  \x1b[36m  yarn dev:tools env edit --env ${envName}\x1b[0m\n`)
    process.exit(0)
  }

  // Guard: warn if the file is staged in git (would expose secrets)
  if (isGitStaged(file)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    warn([
      `  ⚠  ${file} IS STAGED IN GIT WITH PLAINTEXT  ⚠`,
      "",
      `  Committing now would expose secrets.`,
      `  Unstage first: git restore --staged ${file}`,
    ])
    console.log()
    const answer = await new Promise<string>((resolve) => {
      rl.question(`  Encrypt anyway and keep staged? (yes/no): `, resolve)
    })
    rl.close()
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("\nAborted. Run:\n")
      console.log(`  \x1b[36mgit restore --staged ${file}\x1b[0m`)
      console.log(`  \x1b[36myarn dev:tools env encrypt --env ${envName}\x1b[0m\n`)
      process.exit(0)
    }
    console.log()
  }

  process.stdout.write(`Encrypting ${file}... `)
  try {
    execSync(`npx dotenvx encrypt -f ${file}`, {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (err: any) {
    console.log(`\x1b[31m✗\x1b[0m`)
    console.error(`\n\x1b[31mEncryption failed:\x1b[0m`)
    console.error(err?.stderr?.toString() ?? err?.message ?? String(err))
    process.exit(1)
  }
  console.log(`\x1b[32m✓\x1b[0m\n`)

  // Verify no plaintext values remain
  if (hasPlaintextValues(file)) {
    console.error(`\x1b[31m⚠  Encryption completed but some plaintext values may remain in ${file}.\x1b[0m`)
    console.error(`   Inspect the file before committing.\n`)
    process.exit(1)
  }

  console.log(`\x1b[32m✓ ${file} is encrypted. Safe to commit.\x1b[0m\n`)
  console.log(`  Next steps:`)
  console.log(`  \x1b[36m  git add ${file}\x1b[0m`)
  console.log(`  \x1b[36m  git commit -m "chore: update ${envName} env secrets"\x1b[0m\n`)

  // Show git status to confirm state
  try {
    const status = execSync(`git status --short ${file} 2>/dev/null`, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim()
    if (status) {
      console.log(`  Git status: \x1b[33m${status}\x1b[0m\n`)
    }
  } catch {
    // git not available — no-op
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

runEncrypt(envName).catch((err) => { console.error(err); process.exit(1) })
