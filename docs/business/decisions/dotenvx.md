# Decision: Encrypted Secrets with dotenvx

## Context

The previous setup used plain `dotenv` with two files: `.env` (committed template with blank values) and `.env.local` (gitignored, held real secrets). Problems with that approach:

- Secrets split across two files with overlapping keys and no clear ownership
- No encryption — if `.env.local` was accidentally staged, secrets were exposed in plaintext
- No structured multi-environment support — environment switching was done by commenting/uncommenting blocks
- New developer onboarding required manually requesting a `.env.local` from a teammate
- No mechanism to prevent plaintext secrets from being committed
- Code agents operating on the repo could read any secret that ended up in a tracked file

## Decision

Migrate to [dotenvx](https://dotenvx.com/) with the following architecture:

- All secrets are **encrypted at rest** in committed env files (`.env.development`, `.env.staging`, `.env.production`)
- Private decryption keys are stored **exclusively in Keeper** and developer shell environments — never in the repo
- A **no-.env.keys rule** is enforced: dotenvx reads decryption keys from `DOTENV_PRIVATE_KEY_*` environment variables, not from a `.env.keys` file on disk
- The startup command (`dotenvx run`) wraps `next dev` / `next start` — both Next.js and Hono inherit the same decrypted `process.env` from a single load point
- A **pre-commit hook** blocks any attempt to commit `.env.keys` or unencrypted secret patterns
- A **Keeper-integrated CLI** (`yarn dev:tools env setup / edit / rotate`) handles all key and secret operations so developers never manually encrypt, decrypt, or manage key files

## Alternatives Considered

- **Doppler**: Full-featured secrets platform with team sync and audit logs. Rejected — adds external dependency and per-seat cost; Keeper is already the team's vault.
- **Plain dotenv with stricter gitignore**: Keeps things simple but provides no encryption, no commit-time protection, and no structured onboarding.
- **Vault (HashiCorp)**: Overkill for a small team; significant ops overhead.
- **dotenvx with `.env.keys` file**: Simpler but allows code agents or any process with filesystem access to read private keys. Rejected in favor of keys living only in environment variables.

## Tradeoffs

**Pros:**
- Encrypted files are safe to commit — secrets are never exposed in git history
- Private keys only exist in Keeper + developer shells + CI secrets — no plaintext key file in the repo
- Single load point: both Next.js and Hono read from the same `process.env`; no dual-file confusion
- Code agents (Claude, Copilot, etc.) cannot read private keys because they have no access to the developer's shell environment
- Structured multi-environment support with no manual commenting

**Cons:**
- New developer must retrieve keys from Keeper on first setup (`env setup` automates this)
- Key rotation requires notifying the team and updating CI secrets (the `env rotate` command guides this)
- `dotenvx run` wraps all startup commands — adds a small layer but is transparent in practice

## Impact

- `package.json` scripts: all dev/start commands are wrapped with `dotenvx run --env-file=.env.<env>`
- `api/app.ts`: remove `import "dotenv/config"`
- `api/config/config.js`: remove `require("dotenv").config()`
- `api/config/config.service.ts`: **no change** — still reads from `process.env`
- `.env` / `.env.local`: replaced by `.env.development`, `.env.staging`, `.env.production`
- CI/CD (GitHub Actions): `DOTENV_PRIVATE_KEY_PRODUCTION` and `DOTENV_PRIVATE_KEY_STAGING` set as repository secrets
- Digital Ocean App Platform: `DOTENV_PRIVATE_KEY_PRODUCTION` set manually in app environment settings
- Developer onboarding: see [environment-setup runbook](../../development/runbooks/environment-setup)
- Ongoing secret management: see [secret-management runbook](../../development/runbooks/secret-management)
