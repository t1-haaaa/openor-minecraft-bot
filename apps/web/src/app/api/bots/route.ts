import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Production API — server-side only, uses service_role to write to Supabase (RLS bypass for now, but RLS still enforced for anon)
// Execution host (SelfHostedRunner) is separate and will pick up bot via Supabase, not Vercel. Vercel never runs Minecraft process.
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supa = getSupabase();

  // Validate input (production API validation)
  if (!body.serverHost || !body.username) {
    return NextResponse.json({ error: "serverHost and username required" }, { status: 400 });
  }

  const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  // For production, userId should come from Supabase Auth JWT (x-user-id header or Authorization)
  // For now, use demo-user or x-user-id header for test, and create profile if needed
  const userIdHeader = req.headers.get("x-user-id") || req.headers.get("authorization")?.split(" ")[1];
  // Try to get user from JWT if provided, else fallback to demo user (will be created if not exists)
  let userId = "00000000-0000-0000-0000-000000000000"; // fallback demo uuid
  let usernameForProfile = "demo-user";

  // If Authorization Bearer JWT is provided, try to get user id from Supabase
  if (supa && req.headers.get("authorization")) {
    try {
      const token = req.headers.get("authorization")!.split(" ")[1];
      if (token) {
        const { data: { user } } = await supa.auth.getUser(token);
        if (user) {
          userId = user.id;
          usernameForProfile = user.email?.split("@")[0] ?? "user";
        }
      }
    } catch {}
  } else if (req.headers.get("x-user-id")) {
    // For testing without JWT, allow x-user-id if it's a valid uuid, else fallback
    const maybeId = req.headers.get("x-user-id")!;
    if (/^[0-9a-f-]{36}$/i.test(maybeId)) userId = maybeId;
  }

  // Ensure profile exists (upsert)
  if (supa) {
    try {
      await supa.from("profiles").upsert({ id: userId, username: usernameForProfile }, { onConflict: "id" });
    } catch {}
  }

  const forwarded = {
    serverHost: body.serverHost,
    serverPort: Number(body.serverPort) || 25565,
    username: body.username,
    version: body.version,
    credentialsRef: body.credentialsRef || `vault:${body.username}`,
  };

  // If Supabase is configured, persist directly (production source of truth)
  if (supa) {
    try {
      const { error } = await supa.from("bots").insert({
        id: botId,
        user_id: userId,
        server_host: forwarded.serverHost,
        server_port: forwarded.serverPort,
        username: forwarded.username,
        version: forwarded.version,
        provider_id: process.env.EXECUTION_PROVIDER || "self-hosted",
        status: "pending",
        config_ref: forwarded.credentialsRef,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Also insert encrypted config placeholder (real vault would encrypt)
      try {
        await supa.from("bot_configs").insert({
          bot_id: botId,
          encrypted_blob: Buffer.from(JSON.stringify(forwarded)).toString("base64"),
          iv: "placeholder",
          updated_at: new Date().toISOString(),
        });
      } catch {}

      await supa.from("activity").insert({
        bot_id: botId,
        user_id: userId,
        event: "bot_created",
        created_at: new Date().toISOString(),
      });

      // Do NOT start Minecraft process inside Vercel — execution host will pick up via Supabase
      // Return immediately with bot id and status pending (honest: Vercel is not execution host)
      return NextResponse.json({ id: botId, provider_id: process.env.EXECUTION_PROVIDER || "self-hosted", status: "pending" });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Fallback if Supabase not configured (local dev without env) — still return bot id but warn
  // This keeps local dev working without Supabase, but production must have Supabase
  console.warn("SUPABASE_URL not configured — using in-memory fallback (not production)");
  return NextResponse.json({ id: botId, provider_id: process.env.EXECUTION_PROVIDER || "self-hosted", status: "pending", warning: "Supabase not configured" });
}

export async function GET(req: Request) {
  const supa = getSupabase();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });

  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("id");
  const userId = req.headers.get("x-user-id") || "00000000-0000-0000-0000-000000000000";

  if (botId) {
    const { data, error } = await supa.from("bots").select("*").eq("id", botId).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    // RLS will filter if not owner when using anon, but service_role bypasses — in production should use anon + JWT
    return NextResponse.json(data);
  }

  // List bots for user (service_role bypasses RLS, so filter manually for demo)
  const { data, error } = await supa.from("bots").select("*").eq("user_id", userId).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
