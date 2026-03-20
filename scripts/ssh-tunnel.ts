import "dotenv/config"
import { spawn } from "child_process"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import os from "os"
import path from "path"

const mode = process.env.SSH_MODE
let sshKeyPath = process.env.SSH_KEY_PATH
const sshKeyContent = process.env.SSH_PRIVATE_KEY ?? null
const dbHost = mode === "staging" ? process.env.DB_HOST_STAGING : process.env.DB_HOST_PRODUCTION
const dbPort = process.env.DB_PORT || "3306"
const sshUser = process.env.SSH_USER || "root"
const dropletIp = process.env.DROPLET_IP
const localPort = process.env.LOCAL_PORT || "5432"

if (!dbHost) {
  console.error("ERROR: DB_HOST is required (set DB_HOST_PRODUCTION or DB_HOST_STAGING)")
  process.exit(1)
}
if (!dropletIp) {
  console.error("ERROR: DROPLET_IP is required")
  process.exit(1)
}

// If no key file path was provided, check for key content and write to a temp file
if (!sshKeyPath && sshKeyContent) {
  const tmpDir = os.tmpdir()
  sshKeyPath = path.join(tmpDir, "temp_ssh_key")
  writeFileSync(sshKeyPath, sshKeyContent, { mode: 0o600 })
}

const sshArgs: string[] = []

if (sshKeyPath) {
  sshArgs.push("-i", sshKeyPath)
}
sshArgs.push("-o", "StrictHostKeyChecking=no")
sshArgs.push("-L", `${localPort}:${dbHost}:${dbPort}`)
sshArgs.push(`${sshUser}@${dropletIp}`)
sshArgs.push("-N")

console.info(`[ssh-tunnel] Mode: ${mode}`)
console.info(`[ssh-tunnel] Forwarding localhost:${localPort} → ${dbHost}:${dbPort} via ${sshUser}@${dropletIp}`)

const proc = spawn("ssh", sshArgs, { shell: false })

proc.stdout.on("data", (data: Buffer) => {
  console.info(String(data))
})

proc.stderr.on("data", (data: Buffer) => {
  console.error(String(data))
})

proc.on("close", (code: number | null) => {
  console.log("[ssh-tunnel] Connection closed.")

  // Clean up the temporary SSH key file if it was created
  if (sshKeyContent && sshKeyPath && existsSync(sshKeyPath)) {
    unlinkSync(sshKeyPath)
  }
  console.info(`[ssh-tunnel] Exited with code ${code}`)
  process.exit(code === 0 ? 0 : 1)
})

// Keep the script alive
new Promise((resolve, reject) => {
  proc.on("close", (code: number | null) => {
    code === 0 ? resolve(null) : reject(new Error(`Exited with code ${code}`))
  })
}).catch((error) => {
  console.error(`[ssh-tunnel] Error: ${error}`)
})
