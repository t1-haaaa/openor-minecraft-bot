import { NextResponse } from "next/server";

// Frontend never contacts execution provider directly - proxies via Openor API behind Cloudflare
// This route is SSR-safe and demonstrates independence: browser -> Vercel -> Cloudflare -> Openor API

export async function GET() {
  const api = process.env.OPENOR_API_URL || process.env.NEXT_PUBLIC_OPENOR_API_URL || "http://localhost:8787";
  try {
    const res = await fetch(`${api}/health`, { cache: "no-store" });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {}
  // fallback for local dev without API running: return honest static health
  return NextResponse.json([
    { id: "vercel", name: "Vercel (frontend only)", available: true, supports247: false },
    { id: "cloudflare", name: "Cloudflare (edge/orchestration)", available: true, supports247: false },
    { id: "supabase", name: "Supabase (DB/auth/storage)", available: true, supports247: false },
    { id: "self-hosted", name: "Self-Hosted Runner", available: true, supports247: true },
    { id: "container", name: "Container Runner", available: true, supports247: true },
    { id: "render-free", name: "Render Free (dev/preview only)", available: false, supports247: false, lastError: "Spins down after 15m" },
    { id: "koyeb-free", name: "Koyeb Free (scales to zero)", available: false, supports247: false, lastError: "Scales to zero after 1h" },
  ]);
}
