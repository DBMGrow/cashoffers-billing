#!/usr/bin/env tsx
/**
 * env rotate — Guided key rotation for encrypted env files
 *
 * Generates a new keypair for the target environment, re-encrypts the env
 * file with the new public key, displays the new private key once, then
 * walks through a post-rotation checklist.
 *
 * Usage:
 *   yarn dev:tools env rotate              # rotate development
 *   yarn dev:tools env rotate --env staging
 *   yarn dev:tools env rotate --env production
 */

import React, { useState } from "react"
import { render, Box, Text, useApp, useInput } from "ink"
import { execSync } from "child_process"

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "confirm"
  | "rotating"
  | "show-key"
  | "checklist"
  | "done"
  | "error"

interface ChecklistItem {
  label: string
  detail: string
  done: boolean
}

// ─── Env helpers ──────────────────────────────────────────────────────────────

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

function rotateEnvFile(envName: string): string {
  const file = ENV_FILE_MAP[envName]
  const keyName = KEY_NAME_MAP[envName]

  // dotenvx rotate generates a new keypair and re-encrypts the file.
  // It prints the new private key to stdout.
  const output = execSync(`npx dotenvx rotate -f ${file}`, {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  }).toString()

  // Extract new private key from output
  const match = output.match(/DOTENV_PRIVATE_KEY[^=]*=([0-9a-f]{64})/i)
  if (!match) {
    // Fall back: look for any 64-char hex string
    const hexMatch = output.match(/([0-9a-f]{64})/i)
    if (hexMatch) return hexMatch[1]
    throw new Error(`Could not extract new private key from dotenvx output.\n\nOutput:\n${output}`)
  }
  return match[1]
}

// ─── App component ────────────────────────────────────────────────────────────

function EnvRotate({ envName }: { envName: string }) {
  const { exit } = useApp()
  const [step, setStep] = useState<Step>("confirm")
  const [newPrivateKey, setNewPrivateKey] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const keyName = KEY_NAME_MAP[envName]
  const file = ENV_FILE_MAP[envName]
  const envColor = envName === "production" ? "red" : envName === "staging" ? "yellow" : "green"

  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      label: "Update Keeper",
      detail: `CashOffers > Billing / Env Keys → update ${keyName}`,
      done: false,
    },
    {
      label: "Update GitHub Actions",
      detail: `Repo Settings → Secrets → update ${keyName}`,
      done: false,
    },
    {
      label: "Update Digital Ocean App Platform",
      detail: `DO Console → App → Settings → env vars → update ${keyName}`,
      done: false,
    },
    {
      label: "Notify team",
      detail: "Share new key securely (Keeper) — never in Slack/email",
      done: false,
    },
    {
      label: "Commit .env file",
      detail: `git add ${file} && git commit -m "rotate ${envName} env key"`,
      done: false,
    },
    {
      label: "Deploy updated application",
      detail: "Push to trigger CI/CD with new key",
      done: false,
    },
  ])

  const [checklistCursor, setChecklistCursor] = useState(0)

  // ─── Input handling ────────────────────────────────────────────────────────

  useInput((input, key) => {
    if (step === "confirm") {
      if (input === "y" || input === "Y") {
        setStep("rotating")
        setTimeout(() => {
          try {
            const newKey = rotateEnvFile(envName)
            setNewPrivateKey(newKey)
            setStep("show-key")
          } catch (err: any) {
            setErrorMsg(err.message)
            setStep("error")
          }
        }, 50)
      } else if (input === "n" || input === "N" || key.escape) {
        exit()
      }
      return
    }

    if (step === "show-key") {
      if (key.return || input === " ") {
        setStep("checklist")
      }
      return
    }

    if (step === "checklist") {
      if (key.upArrow) {
        setChecklistCursor((c) => Math.max(0, c - 1))
      } else if (key.downArrow) {
        setChecklistCursor((c) => Math.min(checklist.length - 1, c + 1))
      } else if (key.return || input === " ") {
        setChecklist((items) =>
          items.map((item, i) =>
            i === checklistCursor ? { ...item, done: !item.done } : item
          )
        )
      } else if (input === "q" || input === "Q" || key.escape) {
        setStep("done")
      }
      return
    }

    if (step === "done" || step === "error") {
      exit()
    }
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  if (step === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>✗ Rotation failed</Text>
        <Text>{"\n"}</Text>
        <Text>{errorMsg}</Text>
        <Text>{"\n"}</Text>
        <Text dimColor>Press any key to exit.</Text>
      </Box>
    )
  }

  if (step === "confirm") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">{"─".repeat(60)}</Text>
        <Text bold color="blue">{"  "}CashOffers Billing — env rotate</Text>
        <Text bold color="blue">{"─".repeat(60)}</Text>
        <Text>{"\n"}</Text>
        <Text>Rotating: <Text bold color={envColor}>{file}</Text></Text>
        <Text>{"\n"}</Text>
        <Text>This will:</Text>
        <Text>  • Generate a new keypair for {envName}</Text>
        <Text>  • Re-encrypt all values in {file} with the new key</Text>
        <Text>  • Display the new private key <Text bold>once</Text> — save it immediately</Text>
        <Text>{"\n"}</Text>
        <Text color="yellow">You must update Keeper, GitHub Actions, and DO App Platform after rotation.</Text>
        <Text>{"\n"}</Text>
        <Text>Continue? <Text dimColor>(y/n)</Text></Text>
      </Box>
    )
  }

  if (step === "rotating") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">⟳ Generating new keypair and re-encrypting {file}...</Text>
      </Box>
    )
  }

  if (step === "show-key") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">✓ Rotation complete</Text>
        <Text>{"\n"}</Text>
        <Text bold color="yellow">NEW PRIVATE KEY — SAVE THIS NOW</Text>
        <Text dimColor>{"─".repeat(60)}</Text>
        <Text>{"\n"}</Text>
        <Text bold>{keyName}=</Text>
        <Text color="cyan" bold>{newPrivateKey}</Text>
        <Text>{"\n"}</Text>
        <Text dimColor>{"─".repeat(60)}</Text>
        <Text color="red">⚠  This key is shown only once. It is not stored anywhere.</Text>
        <Text color="red">   Save it to Keeper immediately before proceeding.</Text>
        <Text>{"\n"}</Text>
        <Text>Keeper path: <Text bold>CashOffers &gt; Billing / Env Keys</Text></Text>
        <Text>{"\n"}</Text>
        <Text dimColor>Press Enter when you have saved the key.</Text>
      </Box>
    )
  }

  if (step === "checklist") {
    const allDone = checklist.every((i) => i.done)
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">Post-rotation checklist</Text>
        <Text dimColor>Space/Enter to check · Q when done</Text>
        <Text>{"\n"}</Text>
        {checklist.map((item, i) => {
          const isSelected = i === checklistCursor
          return (
            <Box key={item.label} flexDirection="column" marginBottom={0}>
              <Box>
                <Text color={isSelected ? "cyan" : undefined}>
                  {isSelected ? "▶ " : "  "}
                </Text>
                <Text color={item.done ? "green" : undefined}>
                  {item.done ? "✓" : "○"} {item.label}
                </Text>
              </Box>
              {isSelected && (
                <Box marginLeft={4}>
                  <Text dimColor>{item.detail}</Text>
                </Box>
              )}
            </Box>
          )
        })}
        {allDone && (
          <Box marginTop={1}>
            <Text color="green" bold>✓ All items complete. Press Q to finish.</Text>
          </Box>
        )}
      </Box>
    )
  }

  if (step === "done") {
    const incomplete = checklist.filter((i) => !i.done)
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">✓ Rotation workflow complete</Text>
        {incomplete.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellow">Incomplete items:</Text>
            {incomplete.map((i) => (
              <Text key={i.label} color="yellow">  • {i.label}</Text>
            ))}
          </Box>
        )}
        <Text>{"\n"}</Text>
        <Text>Remember to commit <Text bold>{file}</Text> and push to deploy.</Text>
      </Box>
    )
  }

  return null
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function runRotate(envName: string): void {
  const validEnvs = Object.keys(ENV_FILE_MAP)
  if (!validEnvs.includes(envName)) {
    console.error(`Unknown environment: ${envName}`)
    console.error(`Valid: ${validEnvs.join(", ")}`)
    process.exit(1)
  }

  const keyName = KEY_NAME_MAP[envName]
  if (!process.env[keyName]) {
    console.error(`\n✗ ${keyName} is not set.`)
    console.error(`  You need the current key to rotate — retrieve from Keeper.\n`)
    process.exit(1)
  }

  render(<EnvRotate envName={envName} />)
}

// Run when spawned directly — parse --env flag from argv
const envArg = process.argv.indexOf("--env")
const envName = envArg !== -1 ? (process.argv[envArg + 1] ?? "development") : "development"
runRotate(envName)
