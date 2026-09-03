# OPENOR — Minecraft 24/7 Bot Platform

**Free-tier multi-hosting architecture** — Vercel frontend, Cloudflare edge, Supabase DB, ExecutionProvider for persistent bots.

## Architecture

| Layer | Provider | Purpose |
|-------|----------|---------|
| Frontend | **Vercel** | Next.js SSR, no bot process |
| Edge/API | **Cloudflare** | DNS/WAF/CDN, Workers edge only (10ms) |
| Database/Auth | **Supabase** | PostgreSQL, Auth, RLS, Storage (500MB) |
| Execution | **SelfHostedRunner** / **ContainerRunner** | Real persistent Minecraft bots |
| Monitoring | ResourceGovernor + ProviderHealth | Quotas, capacity, health |

**Critical:** Vercel/Workers/Supabase/Render Free/Koyeb Free **MUST NOT** host Minecraft bots — they throw `ProviderNotSuitableError`.

## Quick Start

```bash
npm install
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:8787 (Openor API)
```

Set env from `.env.example` — never commit `.env` containing secrets.

## Verification

```bash
node verify.mjs                    # 26/26 architecture checks
npx tsx runtime-verification.ts    # real process/Minecraft/bot lifecycle proof
npx tsx hardening-verification.ts  # isolation, persistence, host restart, duplicate prevention
```

Evidence: `runtime-evidence.json`, `RUNTIME_VERIFICATION_REPORT.md`

## Deployment

- **Preview (anonymous):** `vercel deploy --temporary --yes` → claim URL (expires 60m)
- **Production:** GitHub `main` → Vercel project (git integration)
  1. `git push` → Vercel build → Ready
  2. Env: `NEXT_PUBLIC_OPENOR_API_URL` (browser) only, secrets server-side
  3. Execution: SelfHosted VPS / Docker host (`ContainerRunner --memory=512m --cpus=0.5`)

See `ARCHITECTURE.md` for full deployment topology and free-tier honesty rules.

## Security

- Secrets AES-GCM encrypted (`vault.ts`), never in `NEXT_PUBLIC_` / localStorage / logs
- RLS in `infra/supabase/schema.sql`
- ResourceGovernor enforces per-user/global quotas

## Production Readiness

See `RUNTIME_VERIFICATION_REPORT.md` — SelfHosted **VERIFIED**, Container **BLOCKED** on non-Docker host (honest), else **VERIFIED** with `--memory=512m`.
v2 2026-09-03T15:14:15.1878565-04:00
