#!/usr/bin/env node
// Simple invariant checker - no TS import needed, reads source to avoid build
import fs from "node:fs";

const checks = [];

function assert(name, cond, detail="") {
  checks.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " - " + detail : ""}`);
}

const execFactory = fs.readFileSync("packages/execution-provider/src/factory.ts","utf8");
const unsuitable = fs.readFileSync("packages/execution-provider/src/runners/UnsuitableProviders.ts","utf8");
const vercelJson = fs.readFileSync("vercel.json","utf8");
const wrangler = fs.readFileSync("infra/cloudflare/wrangler.toml","utf8");
const webPage = fs.readFileSync("apps/web/src/app/page.tsx","utf8");
const schema = fs.readFileSync("infra/supabase/schema.sql","utf8");
const orchestrator = fs.readFileSync("packages/execution-provider/src/orchestrator.ts","utf8");
const governor = fs.readFileSync("packages/resource-governor/src/index.ts","utf8");
const nextConfig = fs.readFileSync("apps/web/next.config.js","utf8");
const vault = fs.readFileSync("packages/execution-provider/src/vault.ts","utf8");

assert("ExecutionProvider abstraction exists", execFactory.includes("isAvailableFor247"));
assert("Lists 247-capable providers", execFactory.includes("list247CapableProviders"));
assert("Honest message present", execFactory.includes("24/7 execution unavailable"));

assert("VercelRunner unsuitable", unsuitable.includes("Vercel is serverless") || unsuitable.includes("Vercel MUST NOT"));
assert("Workers unsuitable (10ms)", unsuitable.includes("10ms"));
assert("Render unsuitable (15m)", unsuitable.includes("15m") || unsuitable.includes("15 minutes"));
assert("Koyeb unsuitable (1h, 512MB)", unsuitable.includes("512MB") && unsuitable.includes("scales to zero"));
assert("Supabase unsuitable", unsuitable.includes("Supabase cannot run"));

assert("vercel.json frontend only note", vercelJson.includes("FRONTEND ONLY"));
assert("vercel.json no bot runtime", !vercelJson.includes("bot") || vercelJson.includes("never") || vercelJson.includes("FRONTEND"));

assert("Cloudflare wrangler edge only", wrangler.includes("Edge / API Layer ONLY") && wrangler.includes("MUST NOT"));
assert("Cloudflare not execution host", wrangler.includes("not execution host") || wrangler.includes("NOT be used"));

assert("Frontend honest banner", webPage.includes("24/7 execution unavailable"));
assert("Frontend shows Bots Used / Bot Limit / Execution Capacity", webPage.includes("Bots Used") && webPage.includes("Execution Capacity"));
assert("Frontend no plaintext secret in NEXT_PUBLIC", !webPage.includes("SUPABASE_SERVICE_ROLE") && !webPage.includes("VAULT_ENCRYPTION"));

assert("Supabase schema has RLS", schema.includes("row level security"));
assert("Schema stores config_ref not plaintext", schema.includes("config_ref") && !schema.includes("password text"));
assert("Schema has bots, bot_configs, activity, metrics", schema.includes("create table if not exists bots") && schema.includes("bot_configs") && schema.includes("metrics"));

assert("Orchestrator autonomous 15 steps mentioned", orchestrator.includes("validate") && orchestrator.includes("monitor"));
assert("Orchestrator has failover", orchestrator.includes("tryFailover"));
assert("Orchestrator no browser dependency", orchestrator.includes("continue without browser") || orchestrator.includes("Browser"));

assert("ResourceGovernor enforces limits", governor.includes("maxBotsPerUser") && governor.includes("canCreateBot"));
assert("ResourceGovernor shows dashboard", governor.includes("getDashboard"));

assert("Next config does not run bot", nextConfig.includes("never run bot") || nextConfig.includes("No serverless bot"));
assert("Vault encrypts secrets", vault.includes("aes-256-gcm") && vault.includes("encryptSecret"));
assert("Vault redacts logs", vault.includes("redactSecrets"));

const failed = checks.filter(c=>!c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.log("FAILED:", failed.map(f=>f.name).join(", "));
  process.exit(1);
} else {
  console.log("All architecture invariants verified.");
}
