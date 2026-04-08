#!/usr/bin/env node
/**
 * install-hooks.js — Symlinks project git hooks into .git/hooks
 *
 * Runs automatically on `yarn install` via the `postinstall` script.
 * Safe to re-run; skips if already linked.
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const HOOKS_SRC = path.join(ROOT, "scripts", "hooks")
const HOOKS_DEST = path.join(ROOT, ".git", "hooks")

// Bail gracefully in CI or environments without a .git directory
if (!fs.existsSync(path.join(ROOT, ".git"))) {
  console.log("  [install-hooks] No .git directory found — skipping hook installation.")
  process.exit(0)
}

if (!fs.existsSync(HOOKS_DEST)) {
  fs.mkdirSync(HOOKS_DEST, { recursive: true })
}

const hooks = fs.readdirSync(HOOKS_SRC).filter((f) => !f.startsWith("."))

let installed = 0
let skipped = 0

for (const hook of hooks) {
  const src = path.join(HOOKS_SRC, hook)
  const dest = path.join(HOOKS_DEST, hook)

  // Already a symlink pointing to the right place — skip
  try {
    const existing = fs.readlinkSync(dest)
    if (existing === src) {
      skipped++
      continue
    }
    // Wrong target — remove and re-link
    fs.unlinkSync(dest)
  } catch {
    // Not a symlink or doesn't exist — proceed
  }

  // Remove regular file if present
  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest)
  }

  fs.symlinkSync(src, dest)
  fs.chmodSync(src, 0o755)
  installed++
}

if (installed > 0) {
  console.log(`  [install-hooks] Installed ${installed} git hook(s): ${hooks.join(", ")}`)
} else {
  console.log(`  [install-hooks] Git hooks already up to date.`)
}
