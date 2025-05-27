#!/usr/bin/env node
import { config } from "@dotenvx/dotenvx"

let configPath = "./scripts/.env.local"
if (process.env.NODE_ENV === "test") configPath = "./scripts/.env.test"
config({ path: ["./scripts/.env.secrets", configPath] })

import { spawn } from "child_process"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import os from "os"
import path from "path"

const mode = process.env.SSH_MODE
let sshKeyPath = process.env.SSH_KEY_PATH
const sshKeyContent = process.env.SSH_PRIVATE_KEY ?? null // Option to pass key directly
const dbHost = mode === "staging" ? process.env.DB_HOST_STAGING : process.env.DB_HOST_PRODUCTION
const dbPort = process.env.DB_PORT || "25060"
const sshUser = process.env.SSH_USER || "root"
const dropletIp = process.env.DROPLET_IP
const localPort = process.env.LOCAL_PORT || "5432"

console.log(dbHost, dbPort, dropletIp, localPort)
if (sshKeyContent) {
  console.log("The SSH Key Starts with", sshKeyContent?.slice(0, 10))
}

if (!dbHost) {
  console.error("ERROR: DB_HOST is required")
  process.exit(1)
}
if (!dropletIp) {
  console.error("ERROR: DROPLET_IP is required")
  process.exit(1)
}

// If no key file path was provided, check for key content and write it to a temporary file.
if (!sshKeyPath && sshKeyContent) {
  const tmpDir = os.tmpdir()
  sshKeyPath = path.join(tmpDir, "temp_ssh_key")
  writeFileSync(sshKeyPath, sshKeyContent, { mode: 0o600 })
}

const sshArgs = []

// Include SSH key flag only if sshKeyPath is provided.
if (sshKeyPath) {
  sshArgs.push("-i", sshKeyPath)
}
sshArgs.push("-o", "StrictHostKeyChecking=no")
sshArgs.push("-L", `${localPort}:${dbHost}:${dbPort}`)
sshArgs.push(`${sshUser}@${dropletIp}`)
sshArgs.push("-N")

console.info(`Connecting to ${dbHost} on port ${dbPort} via ${sshUser}@${dropletIp}...`)
console.info(`Local port: ${localPort}`)

const proc = spawn("ssh", sshArgs, { shell: false })

proc.stdout.on("data", (data) => {
  console.info(String(data))
})

proc.stderr.on("data", (data) => {
  console.error(String(data))
})

proc.on("close", (code) => {
  console.log("!!!!!!!!!!! Connection closed.")

  // Clean up the temporary SSH key file if it was created
  if (sshKeyContent && sshKeyPath && existsSync(sshKeyPath)) {
    unlinkSync(sshKeyPath)
  }
  console.info(`Child process exited with code ${code}`)

  process.exit(code === 0 ? 0 : 1)
})

// Prevent the script from exiting immediately
new Promise((resolve, reject) => {
  proc.on("close", (code) => {
    code === 0 ? resolve(null) : reject(new Error(`Exited with code ${code}`))
  })
}).catch((error) => {
  console.error(`Execution error: ${error}`)
})
