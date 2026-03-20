# Runbook: Local Setup

## Prerequisites
- Node.js v18+
- Yarn
- MySQL 8.0+
- Access to `.env` file (ask a teammate or see `.env.example`)

## Steps

### 1. Install Dependencies
```bash
yarn install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Fill in values — see Critical Variables below
```

**Critical variables:**
```bash
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=cashoffers_billing

SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=...
NEXT_PUBLIC_SQUARE_APP_ID=...
NEXT_PUBLIC_SQUARE_LOCATION_ID=...

API_URL=http://localhost:8000
API_URL_V2=http://localhost:8000/v2
API_MASTER_TOKEN=...

SENDGRID_API_KEY=...
SEND_EMAILS=false   # disable emails locally
DEV_EMAIL=you@example.com

CRON_SECRET=local-secret
```

### 3. Database Setup
```bash
# Ensure MySQL is running
brew services start mysql  # Mac

# Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cashoffers_billing;"

# Generate TypeScript types from schema
yarn codegen
```

### 4. Start Development Server
```bash
yarn dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- API Docs: http://localhost:3000/api/docs

## SSH Tunnel (for staging DB access)
```bash
yarn tunnel        # SSH tunnel only
yarn dev:tunnel    # SSH tunnel + dev server
```

Configure in `.env`:
```bash
SSH_MODE=true
SSH_DROPLET_IP=...
SSH_KEY_PATH=~/.ssh/your_key
```

## Troubleshooting
- **DB connection fails**: Check MySQL is running + `.env` credentials
- **TypeScript path errors**: Run `yarn codegen`, restart TS server in IDE
- **Hot reload not working**: Delete `.next/` and restart `yarn dev`
- **Square errors**: Verify `SQUARE_ENVIRONMENT` matches your token type

## dotenvx Note
The project plans to migrate to dotenvx for encrypted secrets. When that happens, setup steps here will change. See [dotenvx decision](../../business/decisions/dotenvx-todo).
