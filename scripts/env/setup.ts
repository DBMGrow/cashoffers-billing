#!/usr/bin/env tsx
/**
 * env setup — Onboarding for dotenvx private keys
 *
 * Prompts for the DOTENV_PRIVATE_KEY for the target environment, validates it
 * against the encrypted env file, then writes it to the developer's shell
 * profile so it persists across sessions automatically.
 *
 * Usage:
 *   yarn dev:tools env setup                   # development (default)
 *   yarn dev:tools env setup --env staging     # staging
 *   yarn dev:tools env setup --env production  # production (requires confirmation)
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"
import * as os from "os"

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

// ─── Shell profile detection ──────────────────────────────────────────────────

function detectShellProfile(): string {
  const shell = process.env.SHELL ?? ""
  if (shell.includes("fish")) {
    return path.join(os.homedir(), ".config", "fish", "config.fish")
  }
  if (shell.includes("zsh")) {
    return path.join(os.homedir(), ".zshrc")
  }
  return path.join(os.homedir(), ".bashrc")
}

function isKeyInProfile(profilePath: string, keyName: string): boolean {
  try {
    return fs.readFileSync(profilePath, "utf8").includes(keyName)
  } catch {
    return false
  }
}

function appendToProfile(profilePath: string, keyName: string, keyValue: string): void {
  const block = [
    "",
    "# dotenvx — CashOffers Billing (added by yarn dev:tools env setup)",
    `export ${keyName}="${keyValue}"`,
    "",
  ].join("\n")
  fs.appendFileSync(profilePath, block)
}

// ─── Key validation ───────────────────────────────────────────────────────────

function validateKey(envFile: string, keyName: string, keyValue: string): boolean {
  try {
    const output = execSync(`npx dotenvx get --all -f ${envFile}`, {
      env: { ...process.env, [keyName]: keyValue },
      stdio: ["pipe", "pipe", "pipe"],
    }).toString()
    const parsed: Record<string, string> = JSON.parse(output)
    // dotenvx exits 0 even with the wrong key — values remain as "encrypted:..." ciphertext
    return !Object.values(parsed).some((v) => typeof v === "string" && v.startsWith("encrypted:"))
  } catch {
    return false
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runSetup(envName: string): Promise<void> {
  const hr = "─".repeat(60)
  console.log(`\n\x1b[1m\x1b[34m${hr}\x1b[0m`)
  console.log(`\x1b[1m\x1b[34m  CashOffers Billing — Environment Setup\x1b[0m`)
  console.log(`\x1b[1m\x1b[34m${hr}\x1b[0m\n`)

  const keyName = KEY_NAME_MAP[envName]
  const envFile = ENV_FILE_MAP[envName]
  const profilePath = detectShellProfile()

  const envColor = envName === "production" ? "\x1b[31m" : envName === "staging" ? "\x1b[33m" : "\x1b[32m"
  console.log(`Setting up: ${envColor}\x1b[1m${envFile}\x1b[0m\n`)

  // Production confirmation
  if (envName === "production") {
    console.log(`\x1b[33m⚠  Production environment\x1b[0m`)
    console.log(`You are setting up the private key for \x1b[31m\x1b[1m.env.production\x1b[0m.`)
    console.log(`This key decrypts the live system's secrets.\n`)

    const rlConfirm = readline.createInterface({ input: process.stdin, output: process.stdout })
    const confirmAnswer = await new Promise<string>((resolve) =>
      rlConfirm.question(`Type "yes" to continue: `, resolve)
    )
    rlConfirm.close()

    if (confirmAnswer.trim().toLowerCase() !== "yes") {
      console.log("\nAborted.\n")
      process.exit(0)
    }
    console.log()
  }

  // Already fully configured?
  if (process.env[keyName]) {
    console.log(`\x1b[32m✓\x1b[0m ${keyName} is already in your shell environment.\n`)
    if (!isKeyInProfile(profilePath, keyName)) {
      console.log(`  \x1b[33mNote:\x1b[0m It's in your current session but not persisted to ${profilePath}.`)
      console.log(`  Run \x1b[36msource ${profilePath}\x1b[0m after opening a new shell if it disappears.\n`)
    }
    return
  }

  console.log("Steps:")
  console.log(`  1. Paste ${keyName} from Keeper`)
  console.log(`  2. Validate it decrypts ${envFile}`)
  console.log(`  3. Write it to ${profilePath}\n`)
  console.log(`\x1b[33mKeeper path:\x1b[0m CashOffers > Billing / Env Keys\n`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve))

  let validated = false
  let keyValue = ""

  while (!validated) {
    const raw = await ask(`Paste ${keyName}: `)
    keyValue = raw.trim()

    if (!keyValue) {
      console.log("  No value entered. Try again.\n")
      continue
    }

    process.stdout.write("  Validating... ")

    if (validateKey(envFile, keyName, keyValue)) {
      console.log("\x1b[32m✓ Valid\x1b[0m\n")
      validated = true
    } else {
      console.log(`\x1b[31m✗ Could not decrypt ${envFile} with that key.\x1b[0m`)
      console.log("  Double-check the value in Keeper and try again.\n")
    }
  }

  rl.close()

  console.log(`Writing to \x1b[36m${profilePath}\x1b[0m...`)
  appendToProfile(profilePath, keyName, keyValue)
  console.log(`\x1b[32m✓ Done\x1b[0m\n`)

  console.log("Activate in your current terminal session:")
  console.log(`  \x1b[36msource ${profilePath}\x1b[0m`)
  console.log("\nAll future terminal sessions will have it automatically.\n")
}

// Run when spawned directly — parse --env flag from argv
const envArg = process.argv.indexOf("--env")
const envName = envArg !== -1 ? (process.argv[envArg + 1] ?? "development") : "development"

const validEnvs = Object.keys(ENV_FILE_MAP)
if (!validEnvs.includes(envName)) {
  console.error(`Unknown environment: ${envName}`)
  console.error(`Valid: ${validEnvs.join(", ")}`)
  process.exit(1)
}

runSetup(envName).catch((err) => { console.error(err); process.exit(1) })
