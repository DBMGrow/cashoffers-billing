# Runbook: Environment Setup

How to configure secrets and environment variables for local development. Uses [dotenvx](https://dotenvx.com/) — secrets are encrypted in the repo and decrypted at runtime using private keys stored in Keeper.

**Private keys never live in the repo.** They live in your shell environment (written there automatically by the setup command) and in Keeper.

---

## First-time setup

### 1. Install dependencies

```bash
yarn install
```

This also installs the pre-commit git hook that blocks unencrypted secrets from being committed.

### 2. Run the environment setup command

```bash
yarn dev:tools env setup
```

This command will:
1. Check if `DOTENV_PRIVATE_KEY_DEVELOPMENT` is already in your environment
2. If not — prompt you to retrieve it from Keeper (see below) and paste it in
3. Validate the key by test-decrypting `.env.development`
4. Detect your shell (`zsh`, `bash`, or `fish`) and automatically append the export to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`)
5. Confirm setup is complete

You will need to open a new terminal (or run `source ~/.zshrc`) after setup for the export to take effect in existing sessions.

### 3. Get the key from Keeper

The private keys are stored in the shared team vault:

```
Keeper > Shared Folders > CashOffers > Billing / Env Keys
```

For local development you need: **`DOTENV_PRIVATE_KEY_DEVELOPMENT`**

Paste the value when the `env setup` command prompts you. You do not need the staging or production keys for local development.

---

## Setting up staging or production keys

If you need to edit staging or production secrets, run setup for that environment:

```bash
yarn dev:tools env setup --env staging
yarn dev:tools env setup --env production
```

The flow is identical to development setup — the command prompts for the key, validates it decrypts the target env file, and writes it to your shell profile. Production setup includes an extra confirmation prompt.

Once set up, the corresponding `env edit` and `env rotate` commands will work for that environment.

### 4. Start the dev server

```bash
yarn dev
```

`dotenvx run` decrypts `.env.development` using your shell-injected key and starts Next.js. Both the Next.js frontend and Hono API run in the same process and share the same decrypted environment.

---

## Verifying your setup

If the server starts without `Missing required environment variables` errors, setup is complete.

To manually verify decryption works:

```bash
yarn dev:tools env setup
```

Re-running setup will confirm the key is valid without overwriting anything.

---

## Environment files

| File | Committed | Encrypted | Used by |
|---|---|---|---|
| `.env` | Yes | No | Non-secret defaults (PORT, flags, display names) |
| `.env.development` | Yes | Yes | Local development |
| `.env.staging` | Yes | Yes | Staging environment |
| `.env.production` | Yes | Yes | Production environment |
| `.env.local` | No | No | Personal overrides (optional, gitignored) |
| `.env.keys` | No | — | Blocked by pre-commit hook — never use this |

The encrypted files contain ciphertext (safe to read in git). The matching `DOTENV_PRIVATE_KEY_*` variable in your shell is what makes them readable at runtime.

---

## Environment variable loading order

1. `dotenvx run --env-file=.env.<env>` decrypts and injects the environment-specific file
2. `.env` is loaded for non-secret defaults
3. `.env.local` overrides anything above (if present — for personal dev overrides only)
4. `api/config/config.service.ts` validates required vars and exports a typed `config` object

Never access `process.env` directly — always import from `@api/config/config.service`.

---

## Using `.env.local` for personal overrides

`.env.local` is gitignored and never committed. Use it to override variables from `.env.development` for your local setup — for example, switching the SSH tunnel target or pointing to a local database.

```bash
# .env.local (example)
SSH_MODE=production
SSH_KEY_PATH=/Users/you/.ssh/my_key
DATABASE_URL=mysql://...
```

The `dev` and `tunnel` scripts load `.env.development` first, then `.env.local` with `--overload`, so values in `.env.local` always win. Without `--overload`, dotenvx treats the first loaded value as the winner — that's why the flag is required here.

---

## SSH tunnel (staging or production database access)

```bash
yarn tunnel        # SSH tunnel only (uses SSH_MODE from env)
yarn dev           # starts Next.js + tunnel together
```

SSH tunnel config lives in `.env.development`. To override the target environment, set `SSH_MODE` in `.env.local`:

```bash
# .env.local
SSH_MODE=staging     # connect to staging DB
# SSH_MODE=production  # connect to production DB
```

The relevant variables are `SSH_MODE`, `SSH_KEY_PATH`, `SSH_DROPLET_IP`, `SSH_DB_HOST_STAGING`, `SSH_DB_HOST_PRODUCTION`, and `SSH_DB_PORT`.

---

## Troubleshooting

**"Missing required environment variables" on startup**
The private key is not in your environment. Run `yarn dev:tools env setup` and follow the prompts.

**"Failed to decrypt" error**
The key you pasted is wrong or for the wrong environment. Re-check the Keeper vault entry. Run `yarn dev:tools env setup` again to retry.

**Key not persisting between terminal sessions**
The shell profile write may have failed. Check `~/.zshrc` for `export DOTENV_PRIVATE_KEY_DEVELOPMENT=...` — if it's missing, re-run `yarn dev:tools env setup`.

**Need to add or change a secret**
See [secret-management runbook](secret-management).

**Keys were rotated and your key no longer works**
You'll get a "Failed to decrypt" error. Get the new key from Keeper (`Billing / Env Keys`) and run `yarn dev:tools env setup` to update your shell profile.
