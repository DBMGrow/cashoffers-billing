# Decision: TODO — Migrate to dotenvx

## Context
The current setup uses plain `.env` files with `dotenv`. Secrets are stored in `.env` and `.env.local` files, which have risks:
- `.env` with real secrets can accidentally be committed
- No encryption at rest for sensitive values
- No distinction between secret and non-secret config
- Multiple environments (local, staging, production) require manual file management

## Decision
**Not yet made.** This is a planned migration.

Proposed: migrate to [dotenvx](https://dotenvx.com/) for:
- Encrypted `.env` files (secrets encrypted, safe to commit)
- Multi-environment support (`--env-file .env.staging`)
- CLI-based key management

## What Will Need Updating
- `api/config/config.service.ts` — load mechanism
- `.env`, `.env.local` files — format may change
- CI/CD pipeline — key injection
- Developer onboarding — new setup steps
- Docker/deployment config (if applicable)

## Next Action
- [ ] Evaluate dotenvx against current setup
- [ ] Define migration plan for existing `.env` files
- [ ] Update `api/config/config.service.ts` to use dotenvx loader
- [ ] Update onboarding docs in `/docs/development/runbooks/local-setup.md`
