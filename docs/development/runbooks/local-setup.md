# Runbook: Local Setup

## Prerequisites

- Node.js v18+
- Yarn
- MySQL 8.0+
- Access to the Keeper vault: `CashOffers > Billing / Env Keys`

## Steps

### 1. Install dependencies

```bash
yarn install
```

This also installs the pre-commit git hook that blocks unencrypted secrets from being committed.

### 2. Configure environment

```bash
yarn dev:tools env setup
```

This command retrieves nothing automatically — it guides you to copy `DOTENV_PRIVATE_KEY_DEVELOPMENT` from Keeper, validates it, and writes it to your shell profile so you never need to do it again.

See the full [environment setup runbook](environment-setup) for details, troubleshooting, and what to do when keys rotate.

### 3. Database setup

```bash
# Ensure MySQL is running
brew services start mysql

# Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cashoffers_billing;"

# Generate TypeScript types from schema
yarn codegen
```

### 4. Start development server

```bash
yarn dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3000/api

`dotenvx` decrypts `.env.development` at startup using the key in your shell. Both the Next.js frontend and Hono API share the same decrypted environment — no dual-file loading.

---

## SSH tunnel (staging DB access)

```bash
yarn tunnel        # SSH tunnel only
yarn dev           # dev server (tunnel starts automatically if SSH_MODE is set)
```

SSH config (`SSH_DROPLET_IP`, `SSH_KEY_PATH`, etc.) lives in `.env.development` and is already encrypted there.

---

## Troubleshooting

- **"Missing required environment variables"** — run `yarn dev:tools env setup`
- **"Failed to decrypt"** — wrong key; check Keeper and re-run `yarn dev:tools env setup`
- **TypeScript path errors** — run `yarn codegen`, restart TS server in IDE
- **Hot reload not working** — delete `.next/` and restart `yarn dev`
- **Square errors** — verify `SQUARE_ENVIRONMENT` in `.env.development` matches your token type
- **Key stopped working after rotation** — get the new key from Keeper and re-run `yarn dev:tools env setup`
