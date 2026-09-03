/**
 * Openor API - sits behind Cloudflare
 * Architecture: Browser -> Vercel -> Cloudflare -> Openor API -> Supabase + Execution Layer
 * This service orchestrates bots but does NOT require browser to stay open.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createProvider, type ProviderKey } from "../../packages/execution-provider/src/factory.js";
import { BotOrchestrator } from "../../packages/execution-provider/src/orchestrator.js";
import { ProviderHealthMonitor } from "../../packages/provider-health/src/index.js";
import { ResourceGovernor } from "../../packages/resource-governor/src/index.js";
import { MemoryAdapter } from "../../packages/database/src/index.js";
import { SupabaseRealtimeAdapter } from "../../packages/realtime/src/index.js";
import { MemoryStorageAdapter } from "../../packages/storage/src/index.js";

const app = new Hono();

app.use("*", cors({ origin: "*", allowMethods: ["GET","POST","DELETE","PATCH"] }));

const db = new MemoryAdapter();
const realtime = new SupabaseRealtimeAdapter();
const storage = new MemoryStorageAdapter();
const governor = new ResourceGovernor();
const health = new ProviderHealthMonitor(ProviderHealthMonitor.defaultHealth());

// Use replaceable ExecutionProvider - default to self-hosted/container (real 24/7)
const PRIMARY: ProviderKey = (process.env.EXECUTION_PROVIDER as ProviderKey) || "self-hosted";
const FALLBACKS: ProviderKey[] = ["container", "remote-vps"];
const orchestrator = new BotOrchestrator(PRIMARY, FALLBACKS);

app.get("/health", (c) => c.json(health.getAll()));
app.get("/capacity", (c) => {
  // anonymous demo: use global governor dashboard placeholder
  const dash = governor.getDashboard("demo-user");
  return c.json(dash);
});

app.post("/bots", async (c) => {
  const body = await c.req.json();
  const userId = c.req.header("x-user-id") || "demo-user"; // in prod: from Supabase auth JWT

  // Resource Governor enforcement
  const check = governor.canCreateBot(userId);
  if (!check.allowed) return c.json({ error: check.reason }, 429);

  const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const config = {
    id: botId,
    userId,
    serverHost: body.serverHost,
    serverPort: Number(body.serverPort) || 25565,
    username: body.username,
    version: body.version,
    credentialsRef: body.credentialsRef || `vault:${userId}:${botId}`,
  };

  // Persist to DB (Supabase) before starting execution - preserves migration on failover
  await db.createBot({
    id: botId, user_id: userId, server_host: config.serverHost, server_port: config.serverPort,
    username: config.username, provider_id: PRIMARY, status: "starting", config_ref: config.credentialsRef,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });

  const state = await orchestrator.startBot(config, async (s) => {
    await db.updateBot(s.botId, { status: s.status, provider_id: s.providerId, updated_at: new Date().toISOString() });
    await realtime.publish({ botId: s.botId, type: "status", payload: s, at: new Date().toISOString() });
  });

  governor.recordCreate(userId, 256);
  return c.json({ id: botId, provider_id: state.providerId, status: state.status });
});

app.get("/bots/:id", async (c) => {
  const id = c.req.param("id");
  const row = await db.getBot(id);
  if (!row) return c.json({ error: "not found" }, 404);
  const provider = createProvider((row.provider_id as ProviderKey) || PRIMARY);
  const pState = await provider.getStatus(id).catch(()=>null);
  const history = await realtime.getHistory(id, 20);
  return c.json({ bot: row, process: pState, history });
});

app.delete("/bots/:id", async (c) => {
  const id = c.req.param("id");
  const row = await db.getBot(id);
  if (!row) return c.json({ error: "not found" }, 404);
  const provider = createProvider((row.provider_id as ProviderKey) || PRIMARY);
  await provider.stop(id);
  await db.updateBot(id, { status: "stopped", updated_at: new Date().toISOString() });
  return c.json({ ok: true });
});

// Event stream - browser reconnects: load persisted state + replay events
app.get("/bots/:id/events", async (c) => {
  const id = c.req.param("id");
  const history = await realtime.getHistory(id, 100);
  const bot = await db.getBot(id);
  return c.json({ bot, history });
});

const port = Number(process.env.PORT) || 8787;
console.log(`Openor API listening on :${port} (primary provider: ${PRIMARY}, supports 24/7: ${createProvider(PRIMARY).isAvailableFor247()})`);
if (!createProvider(PRIMARY).isAvailableFor247()) {
  console.warn("24/7 execution unavailable on the current free execution provider.");
}

export default {
  port,
  fetch: app.fetch,
};

// For Node execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port } as any);
}
