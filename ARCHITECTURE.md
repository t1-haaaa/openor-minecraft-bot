# FREE-TIER MULTI-HOSTING ARCHITECTURE - Implementation

## Hosting Principle (8 layers) - Each provider hosts exactly one concern

| Layer | Provider | Purpose | Free limits enforced |
|-------|----------|---------|---------------------|
| 1 Frontend | **Vercel** | Next.js, SSR, routing, previews, CI/CD | No bot processes |
| 2 Edge/API | **Cloudflare** | DNS/WAF/CDN, rate limiting, workers (orchestration only) | 100k req/day, 10ms CPU |
| 3 Database/Auth | **Supabase** | Postgres, Auth, RLS, Realtime | 50k MAU, 500MB DB, 1GB storage, pauses |
| 4 Storage | **Supabase Storage** (or R2/S3) | backups, logs, snapshots | Persistent, not ephemeral FS |
| 5 Realtime | **Supabase Realtime** | Browser ↔ Backend ↔ Bot events | Bot lives even if WS disconnects |
| 6 Execution | **ExecutionProvider** | Real persistent Minecraft bots | See honesty table |
| 7 Monitoring | ProviderHealthMonitor + ResourceGovernor | availability, quotas, capacity | No fake traffic |
| 8 Integrations | Openor API | External webhooks, notifications | - |

## ExecutionProvider Abstraction

```
interface ExecutionProvider {
  id, name, capabilities,
  isAvailableFor247(): boolean,
  validateConfig, start, stop, getStatus, healthCheck, streamLogs, restart
}
```

Implementations: `packages/execution-provider/src/runners/`

- ✅ `SelfHostedRunner` - RECOMMENDED 24/7 (true persistence, process isolation)
- ✅ `ContainerRunner` - Docker per-bot isolation + resource limits
- ✅ `RemoteVPSRunner` - SSH/API to VPS (failover target)
- ✅ `CloudSandboxRunner` - E2B/Fly Machines style (future)
- ⚠️ `LocalAgentRunner` - user device, `supports247: false` (honest)
- ❌ `VercelRunner` - throws ProviderNotSuitableError
- ❌ `CloudflareWorkersRunner` - throws (10ms CPU)
- ❌ `RenderFreeRunner` - throws (15m sleep, ephemeral FS)
- ❌ `KoyebFreeRunner` - throws (1h scale-to-zero, 512MB/0.1vCPU)
- ❌ `SupabaseRunner` - throws (DB only)

Selection: `packages/execution-provider/src/factory.ts:13` `createProvider(key)`
Honest message: `getHonestAvailabilityMessage()` -> "24/7 execution unavailable..."

## Deployment Topology

```
            INTERNET
               │
               ▼
         CLOUDFLARE
     DNS / WAF / CDN
               │
               ▼
          VERCEL
     Web / Next.js App  (apps/web)  -> vercel.json frontend only
               │
               ▼
        OPENOR API      (apps/api)  -> Hono, behind Cloudflare
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
SUPABASE          EXECUTION LAYER
PostgreSQL        SelfHosted / Container / RemoteVPS
Auth              Process Manager, health checks, restart
Storage           Containers, per-bot env isolation
Realtime          Health/reconnect/crash recovery
     │                   │
     └─────────┬─────────┘
               ▼
        EVENT / MONITORING
     ProviderHealth, ResourceGovernor
               │
               ▼
            BROWSER (temporary - bot continues after close)
```

## Autonomous Operation (after Start Bot)

1. validate configuration
2. validate permissions (Supabase RLS)
3. create/reuse execution env
4. prepare dependencies
5. start real bot process (spawn/ docker run)
6. monitor output
7. detect connection state
8. detect crashes
9. reconnect when required
10. restart after failure when policy permits
11. enforce resource limits (ResourceGovernor)
12. update dashboard (Realtime publish)
13. persist state (DB)
14. send notifications
15. continue without browser

Implemented in `packages/execution-provider/src/orchestrator.ts:15` `BotOrchestrator.startBot()`

Human intervention only when: invalid creds, manual auth, security block, capacity exhausted, config change, destructive confirmation.

## Failover

```
Primary Execution Provider
↓ unavailable
Fallback Execution Provider
↓ Start Bot
↓ Restore Config (from DB vault)
↓ Reconnect
↓ Resume Monitoring
```

Preserves: config, automation, schedules, credentials (encrypted), metadata, logs (where possible).
Implemented in `orchestrator.ts:70` `tryFailover()` + `provider-health/src/index.ts:65` `getFailoverTarget()`

## Honest Availability Rule

Frontend `apps/web/src/app/page.tsx:14` shows banner:

- If any execution provider with `supports247 && available` exists -> green "24/7 execution available"
- Else -> red "24/7 execution unavailable on the current free execution provider."

No fake traffic, no TOS bypass, no keep-alive hacks.

## Secrets

- Never in `NEXT_PUBLIC_` , Vercel client, localStorage, repo, logs, console
- Server-side only: `OPENOR_API_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAULT_ENCRYPTION_KEY`
- Vault: `packages/execution-provider/src/vault.ts` AES-GCM encrypt -> `bot_configs.encrypted_blob`
- Logging uses `redactSecrets()` - see `vault.ts:30`

## Resource Governor

`packages/resource-governor/src/index.ts:15` `FREE_MVP_LIMITS`
- `maxBotsPerUser: 2`, `maxBotsGlobal: 10` (based on verified capacity)
- UI shows Bots Used / Bot Limit / Execution Capacity / Resource Usage via `/api/capacity`

## Verification checklist (pre-production)

- [ ] Vercel deployment (frontend preview works, no bot code bundled)
- [ ] Cloudflare DNS/WAF/CDN + wrangler.toml edge only
- [ ] Supabase DB + auth + RLS + storage + realtime channels
- [ ] Real bot process on ExecutionProvider (SelfHosted/Container) stays alive after browser close
- [ ] Process restart / reconnect / crash recovery
- [ ] Resource limits enforced (governor 429)
- [ ] Logs + monitoring + provider health dashboard
- [ ] Secrets not leaked to client bundle (grep NEXT_PUBLIC_)
- [ ] Backups to persistent storage (not ephemeral FS)
- [ ] Multi-bot isolation (per-container env)
- [ ] Mobile interface (responsive)

Final report must state which provider hosts each layer (table above).
Never claim "100% free" if execution requires paid VPS - mark honestly.
