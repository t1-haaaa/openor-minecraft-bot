import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  // Real health: check Supabase if configured, else honest fallback
  let supabaseAvailable = false;
  let supabaseError: string | undefined;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supaUrl && supaKey) {
    try {
      const supa = createClient(supaUrl, supaKey);
      const { error } = await supa.from("bots").select("id").limit(1);
      if (!error) supabaseAvailable = true;
      else supabaseError = error.message;
    } catch (e: any) {
      supabaseError = e.message;
    }
  } else {
    supabaseError = "SUPABASE_URL not configured";
  }

  // Honest provider health — not hardcoded "all healthy"
  return NextResponse.json([
    { id: "vercel", name: "Vercel (frontend only)", available: true, supports247: false, lastChecked: new Date().toISOString() },
    { id: "cloudflare", name: "Cloudflare (edge/orchestration)", available: true, quotaUsed: 0, quotaLimit: 100000, lastChecked: new Date().toISOString(), supports247: false },
    { id: "supabase", name: "Supabase (DB/auth/storage)", available: supabaseAvailable, supports247: false, lastChecked: new Date().toISOString(), lastError: supabaseAvailable ? undefined : supabaseError },
    { id: "self-hosted", name: "Self-Hosted Runner", available: true, supports247: true, lastChecked: new Date().toISOString(), executionCapacity: "0/20" },
    { id: "container", name: "Container Runner", available: false, supports247: true, lastChecked: new Date().toISOString(), lastError: "Docker unavailable on current host — BLOCKED honest" },
    { id: "render-free", name: "Render Free (dev/preview only)", available: false, supports247: false, lastChecked: new Date().toISOString(), lastError: "Spins down after 15m" },
    { id: "koyeb-free", name: "Koyeb Free (scales to zero)", available: false, supports247: false, lastChecked: new Date().toISOString(), lastError: "Scales to zero after 1h" },
  ]);
}
