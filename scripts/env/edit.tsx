#!/usr/bin/env tsx
/**
 * env edit — Interactive Ink TUI for editing encrypted env files
 *
 * Decrypts the target env file, shows all key-value pairs in a navigable
 * list, and re-encrypts on save. Values are masked by default.
 *
 * Usage:
 *   yarn dev:tools env edit                   # development (default)
 *   yarn dev:tools env edit --env staging     # staging
 *   yarn dev:tools env edit --env production  # production (requires confirmation)
 */

import React, { useState, useCallback, useEffect } from "react"
import { render, Box, Text, useApp, useInput, useStdout } from "ink"
import TextInput from "ink-text-input"
import { execSync } from "child_process"
import * as fs from "fs"

// ─── Types ────────────────────────────────────────────────────────────────────

type EnvEntry = { key: string; value: string; original: string }
type Screen = "list" | "edit" | "add-key" | "add-value" | "confirm-prod" | "saved" | "error"

// ─── Env file helpers ─────────────────────────────────────────────────────────

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

/** Returns the set of keys explicitly defined in the raw env file (ignores comments/blanks). */
function getFileKeys(file: string): Set<string> {
  const content = fs.readFileSync(file, "utf8")
  const keys = new Set<string>()
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx > 0) keys.add(trimmed.slice(0, eqIdx).trim())
  }
  return keys
}

function loadEntries(envName: string): EnvEntry[] {
  const file = ENV_FILE_MAP[envName]
  const keyName = KEY_NAME_MAP[envName]

  if (!process.env[keyName]) {
    throw new Error(
      `${keyName} is not set.\nRun: yarn dev:tools env setup\nOr retrieve it from Keeper: CashOffers > Billing / Env Keys`
    )
  }

  const fileKeys = getFileKeys(file)

  const raw = execSync(`npx dotenvx get --all -f ${file}`, {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  }).toString()

  const parsed: Record<string, string> = JSON.parse(raw)
  // Only show keys that are actually defined in the file (dotenvx --all inherits the full process env)
  return Object.entries(parsed)
    .filter(([k]) => fileKeys.has(k) && !k.startsWith("DOTENV_PUBLIC_KEY"))
    .map(([key, value]) => ({ key, value, original: value }))
}

function saveEntry(envName: string, key: string, value: string): void {
  const file = ENV_FILE_MAP[envName]
  const escaped = value.replace(/"/g, '\\"')
  execSync(`npx dotenvx set ${key} "${escaped}" -f ${file}`, {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  })
}

function deleteEntry(envName: string, key: string): void {
  const file = ENV_FILE_MAP[envName]
  // dotenvx doesn't have a delete command; we use `set` with empty string
  // which sets the key to blank (encrypted empty). This preserves the key schema.
  execSync(`npx dotenvx set ${key} "" -f ${file}`, {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  })
}

// ─── App component ────────────────────────────────────────────────────────────

function EnvEditor({ envName }: { envName: string }) {
  const { exit } = useApp()

  const [screen, setScreen] = useState<Screen>(() => {
    if (envName === "production") return "confirm-prod"
    return "list"
  })

  const [entries, setEntries] = useState<EnvEntry[]>([])
  const [cursor, setCursor] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [confirmInput, setConfirmInput] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [statusMsg, setStatusMsg] = useState("")
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set())

  // Load entries once we're on the list screen
  const loadData = useCallback(() => {
    try {
      const loaded = loadEntries(envName)
      setEntries(loaded)
      setCursor(0)
    } catch (err: any) {
      setErrorMsg(err.message)
      setScreen("error")
    }
  }, [envName])

  // Auto-load for non-production (production waits for confirm screen)
  useEffect(() => {
    if (envName !== "production") loadData()
  }, [])

  // ─── Keyboard handling ──────────────────────────────────────────────────────

  useInput((input, key) => {
    if (screen === "confirm-prod") {
      // Handled by TextInput
      return
    }

    if (screen === "edit" || screen === "add-key" || screen === "add-value") {
      // Handled by TextInput
      return
    }

    if (screen === "saved" || screen === "error") {
      exit()
      return
    }

    if (screen === "list") {
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1))
      } else if (key.downArrow) {
        setCursor((c) => Math.min(entries.length - 1, c + 1))
      } else if (key.return) {
        // Edit selected entry
        const entry = entries[cursor]
        if (entry) {
          setEditValue(entry.value)
          setScreen("edit")
        }
      } else if (input === "r" || input === "R") {
        setRevealed((r) => !r)
      } else if (input === "a" || input === "A") {
        setNewKey("")
        setNewValue("")
        setScreen("add-key")
      } else if (input === "d" || input === "D") {
        const entry = entries[cursor]
        if (entry) {
          try {
            deleteEntry(envName, entry.key)
            setEntries((prev) => prev.map((e, i) => i === cursor ? { ...e, value: "", original: "" } : e))
            setPendingChanges((s) => new Set(s).add(entry.key))
            setStatusMsg(`Cleared ${entry.key}`)
          } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`)
          }
        }
      } else if (input === "s" || input === "S") {
        setScreen("saved")
      } else if (input === "q" || input === "Q" || key.escape) {
        exit()
      }
    }
  })

  // ─── Transitions ───────────────────────────────────────────────────────────

  function handleConfirmProd(value: string) {
    setConfirmInput(value)
  }

  function handleConfirmProdSubmit(value: string) {
    if (value.trim().toLowerCase() === "yes") {
      loadData()
      setScreen("list")
    } else {
      exit()
    }
  }

  function handleEditSubmit(value: string) {
    const entry = entries[cursor]
    if (entry && value !== entry.value) {
      try {
        saveEntry(envName, entry.key, value)
        setEntries((prev) =>
          prev.map((e, i) => (i === cursor ? { ...e, value } : e))
        )
        setPendingChanges((s) => new Set(s).add(entry.key))
        setStatusMsg(`Saved ${entry.key}`)
      } catch (err: any) {
        setStatusMsg(`Error saving ${entry.key}: ${err.message}`)
      }
    }
    setScreen("list")
  }

  function handleAddKeySubmit(value: string) {
    setNewKey(value.trim())
    setScreen("add-value")
  }

  function handleAddValueSubmit(value: string) {
    if (newKey) {
      try {
        saveEntry(envName, newKey, value)
        const newEntry = { key: newKey, value, original: "" }
        setEntries((prev) => [...prev, newEntry])
        setPendingChanges((s) => new Set(s).add(newKey))
        setCursor(entries.length)
        setStatusMsg(`Added ${newKey}`)
      } catch (err: any) {
        setStatusMsg(`Error adding ${newKey}: ${err.message}`)
      }
    }
    setNewKey("")
    setNewValue("")
    setScreen("list")
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (screen === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>✗ Error loading {ENV_FILE_MAP[envName]}</Text>
        <Text>{"\n"}</Text>
        <Text>{errorMsg}</Text>
        <Text>{"\n"}</Text>
        <Text dimColor>Press any key to exit.</Text>
      </Box>
    )
  }

  if (screen === "confirm-prod") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow" bold>⚠  Production environment</Text>
        <Text>{"\n"}</Text>
        <Text>You are about to edit <Text bold color="red">.env.production</Text>.</Text>
        <Text>This affects the live system.</Text>
        <Text>{"\n"}</Text>
        <Box>
          <Text>Type "yes" to continue: </Text>
          <TextInput
            value={confirmInput}
            onChange={handleConfirmProd}
            onSubmit={handleConfirmProdSubmit}
          />
        </Box>
      </Box>
    )
  }

  if (screen === "saved") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>✓ Changes saved to {ENV_FILE_MAP[envName]}</Text>
        {pendingChanges.size > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Modified keys: {Array.from(pendingChanges).join(", ")}</Text>
          </Box>
        )}
      </Box>
    )
  }

  if (screen === "edit") {
    const entry = entries[cursor]
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">Editing: <Text color="cyan">{entry?.key}</Text></Text>
        <Text>{"\n"}</Text>
        <Box>
          <Text>Value: </Text>
          <TextInput
            value={editValue}
            onChange={setEditValue}
            onSubmit={handleEditSubmit}
          />
        </Box>
        <Text>{"\n"}</Text>
        <Text dimColor>Enter to save · Esc to cancel</Text>
      </Box>
    )
  }

  if (screen === "add-key") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">Add new key</Text>
        <Text>{"\n"}</Text>
        <Box>
          <Text>Key name: </Text>
          <TextInput value={newKey} onChange={setNewKey} onSubmit={handleAddKeySubmit} />
        </Box>
        <Text>{"\n"}</Text>
        <Text dimColor>Enter to continue · Ctrl+C to cancel</Text>
      </Box>
    )
  }

  if (screen === "add-value") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">Add new key: <Text color="cyan">{newKey}</Text></Text>
        <Text>{"\n"}</Text>
        <Box>
          <Text>Value: </Text>
          <TextInput value={newValue} onChange={setNewValue} onSubmit={handleAddValueSubmit} />
        </Box>
        <Text>{"\n"}</Text>
        <Text dimColor>Enter to save · Ctrl+C to cancel</Text>
      </Box>
    )
  }

  // ─── List screen ────────────────────────────────────────────────────────────

  const file = ENV_FILE_MAP[envName]
  const envColor = envName === "production" ? "red" : envName === "staging" ? "yellow" : "green"

  const { stdout } = useStdout()
  // Header=3 lines, subheader=1, status=1 (conditional), footer=3, padding=2
  const CHROME_LINES = 11
  const termRows = stdout?.rows ?? 24
  const visibleCount = Math.max(3, termRows - CHROME_LINES)
  const scrollOffset = Math.max(0, Math.min(cursor - Math.floor(visibleCount / 2), entries.length - visibleCount))
  const visibleEntries = entries.slice(scrollOffset, scrollOffset + visibleCount)

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Text bold color="blue">
          {"─".repeat(60)}{"\n"}
          {"  "}CashOffers Billing — env edit{"\n"}
          {"─".repeat(60)}
        </Text>
      </Box>

      <Box paddingX={2} paddingBottom={1}>
        <Text>File: </Text>
        <Text color={envColor} bold>{file}</Text>
        <Text>{"  "}{cursor + 1}/{entries.length}</Text>
        {pendingChanges.size > 0 && <Text color="yellow">{"  "}● {pendingChanges.size} unsaved</Text>}
      </Box>

      {/* Key-value list */}
      <Box flexDirection="column" paddingX={2}>
        {scrollOffset > 0 && (
          <Text dimColor>  ↑ {scrollOffset} more above</Text>
        )}
        {visibleEntries.map((entry, vi) => {
          const i = vi + scrollOffset
          const isSelected = i === cursor
          const isChanged = pendingChanges.has(entry.key)
          const displayValue = revealed ? entry.value || "(empty)" : entry.value ? "••••••••" : "(empty)"

          return (
            <Box key={entry.key}>
              <Text color={isSelected ? "cyan" : undefined}>
                {isSelected ? "▶ " : "  "}
              </Text>
              <Text
                color={isChanged ? "yellow" : undefined}
                bold={isSelected}
              >
                {entry.key.padEnd(35)}
              </Text>
              <Text dimColor={!isSelected} color={isSelected ? "white" : undefined}>
                {displayValue}
              </Text>
              {isChanged && <Text color="yellow"> ●</Text>}
            </Box>
          )
        })}
        {scrollOffset + visibleCount < entries.length && (
          <Text dimColor>  ↓ {entries.length - scrollOffset - visibleCount} more below</Text>
        )}
      </Box>

      {/* Status */}
      {statusMsg && (
        <Box paddingX={2} marginTop={1}>
          <Text color="green">{statusMsg}</Text>
        </Box>
      )}

      {/* Controls */}
      <Box paddingX={2} marginTop={1} flexDirection="column">
        <Text dimColor>{"─".repeat(58)}</Text>
        <Text dimColor>
          ↑↓ navigate · Enter edit · R reveal/hide · A add · D clear · S quit+save · Q quit
        </Text>
      </Box>
    </Box>
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function runEdit(envName: string): void {
  const validEnvs = Object.keys(ENV_FILE_MAP)
  if (!validEnvs.includes(envName)) {
    console.error(`Unknown environment: ${envName}`)
    console.error(`Valid: ${validEnvs.join(", ")}`)
    process.exit(1)
  }

  const keyName = KEY_NAME_MAP[envName]
  if (envName !== "production" && !process.env[keyName]) {
    console.error(`\n✗ ${keyName} is not set.`)
    console.error(`  Run: yarn dev:tools env setup\n`)
    process.exit(1)
  }
  if (envName === "production" && !process.env[keyName]) {
    console.error(`\n✗ ${keyName} is not set.`)
    console.error(`  Retrieve it from Keeper: CashOffers > Billing / Env Keys\n`)
    process.exit(1)
  }

  render(<EnvEditor envName={envName} />)
}

// Run when spawned directly — parse --env flag from argv
const envArg = process.argv.indexOf("--env")
const envName = envArg !== -1 ? (process.argv[envArg + 1] ?? "development") : "development"
runEdit(envName)
