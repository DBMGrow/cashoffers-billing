# Runbook: Secret Management

How to add, edit, and rotate secrets using the interactive CLI. All encryption and decryption is handled automatically — you never touch raw dotenvx commands.

**Prerequisite:** You must have completed [environment setup](environment-setup) and have the relevant `DOTENV_PRIVATE_KEY_*` in your shell.

---

## Adding or editing secrets

```bash
yarn dev:tools env edit
```

Opens an interactive terminal UI (Ink). By default opens the `development` environment.

```
┌─ cashoffers-billing env editor ──────────────────────────────────┐
│  Environment: [development ▼]                           [R] Reveal│
│                                                                    │
│  ● DB_HOST            db.staging.cashoffers.pro    [edit] [del]   │
│  ● DB_PASS            ••••••••••••                 [edit] [del]   │
│  ● SQUARE_ACCESS_TOKEN ••••••••••••                [edit] [del]   │
│  + Add new secret                                                  │
│                                                                    │
│  [S] Save & encrypt    [Q] Quit without saving                    │
└───────────────────────────────────────────────────────────────────┘
```

**Controls:**
- `↑ / ↓` — navigate (list scrolls automatically when entries exceed terminal height)
- `Enter` — edit selected key
- `R` — toggle reveal/mask all values
- `D` — delete selected key (prompts for confirmation)
- `A` — add new key/value pair
- `S` — save and re-encrypt the file
- `Q` — quit without saving

The header shows a position counter (`1/32`) so you always know where you are in a long list. `↑ N more above` / `↓ N more below` indicators appear at the list boundaries when content is scrolled.

**To edit staging secrets:**

```bash
yarn dev:tools env edit --env staging
```

Requires `DOTENV_PRIVATE_KEY_STAGING` in your environment (available in Keeper under `Billing / Env Keys`).

**To edit production secrets:**

```bash
yarn dev:tools env edit --env production
```

Requires `DOTENV_PRIVATE_KEY_PRODUCTION` and shows a confirmation prompt before opening. Production edits should be rare — prefer updating via the staging → production promotion flow.

### What happens on save

1. All modified values are encrypted using the public key already embedded in the `.env.<env>` file header (no private key needed to encrypt — only to decrypt)
2. The encrypted file is written back in place
3. The file is ready to commit — no plaintext secrets exist in it

---

## Bulk editing (decrypt → edit → encrypt)

For large changes (many secrets at once), use the decrypt/encrypt workflow instead of the interactive editor.

```bash
yarn dev:tools env decrypt
```

This writes plaintext values back into the env file so you can edit it directly. **Do not commit the file while it is decrypted.**

After editing:

```bash
yarn dev:tools env encrypt
```

This re-encrypts all plaintext values in place and confirms the file is safe to commit. The command will warn you if the file is staged in git before encryption completes.

For non-default environments:

```bash
yarn dev:tools env decrypt --env staging
yarn dev:tools env encrypt --env staging
```

Production decrypt requires typing `"yes, decrypt production"` to proceed.

> **Tip:** For adding or changing individual secrets, prefer `env edit` — it's safer since secrets are never written as plaintext.

---

## Rotating keys

Run when: a developer leaves the team, a key may have been exposed, or as a periodic security practice.

```bash
yarn dev:tools env rotate
```

By default rotates all environments. To rotate a single environment:

```bash
yarn dev:tools env rotate --env development
yarn dev:tools env rotate --env staging
yarn dev:tools env rotate --env production
```

### What the rotation command does

1. Generates new asymmetric keypairs for each selected environment
2. Re-encrypts the existing secrets in each `.env.<env>` file with the new public key
3. Displays the new private keys **once** in the terminal (they are not written to any file in the repo)
4. Presents an interactive checklist to guide post-rotation steps

### Post-rotation checklist (shown in terminal)

The `env rotate` command walks you through this interactively, but the steps are:

```
[ ] Update Keeper: "CashOffers > Billing / Env Keys" with all new DOTENV_PRIVATE_KEY_* values
[ ] Update GitHub Actions secret: DOTENV_PRIVATE_KEY_STAGING
[ ] Update GitHub Actions secret: DOTENV_PRIVATE_KEY_PRODUCTION
[ ] Update Digital Ocean App Platform: DOTENV_PRIVATE_KEY_PRODUCTION (manual — see below)
[ ] Notify team: each developer must run `yarn dev:tools env setup` to pull new keys
[ ] Commit the updated .env.* files (they contain new ciphertext — safe to commit)
```

**Updating GitHub Actions secrets:**
Repository Settings → Secrets and variables → Actions → update `DOTENV_PRIVATE_KEY_STAGING` and `DOTENV_PRIVATE_KEY_PRODUCTION`.

**Updating Digital Ocean App Platform:**
App Settings → Environment Variables → update `DOTENV_PRIVATE_KEY_PRODUCTION` → Save and redeploy.

### After rotation — for each developer

Each developer whose key stopped working must re-run setup:

```bash
yarn dev:tools env setup
```

This will prompt them for the new key from Keeper and update their shell profile automatically.

---

## Key storage reference

| Key | Where it lives |
|---|---|
| `DOTENV_PRIVATE_KEY_DEVELOPMENT` | Keeper vault + developer `~/.zshrc` (written by `env setup`) |
| `DOTENV_PRIVATE_KEY_STAGING` | Keeper vault + GitHub Actions secret + developer shell (if needed) |
| `DOTENV_PRIVATE_KEY_PRODUCTION` | Keeper vault + GitHub Actions secret + Digital Ocean App Platform env var |

Keys are never stored in the repository. The `.env.keys` file is blocked by the pre-commit hook.

---

## Rules

- **Never commit `.env.keys`** — the pre-commit hook will block it, but don't try to bypass it
- **Never paste private keys into code, docs, or chat** — always use Keeper as the source of truth
- **Never add plaintext secrets to `.env`** — that file is committed and not encrypted; it is for non-sensitive defaults only
- **When in doubt, rotate** — rotation is a two-minute operation; the `env rotate` command guides the whole process
