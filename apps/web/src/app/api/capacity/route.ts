import { NextResponse } from "next/server";

export async function GET() {
  const api = process.env.OPENOR_API_URL || "http://localhost:8787";
  try {
    const res = await fetch(`${api}/capacity`, { cache: "no-store" });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {}
  return NextResponse.json({ botsUsed: 0, botLimit: 2, executionCapacity: "0/10", limits: { maxBotsPerUser: 2, maxBotsGlobal: 10 } });
}
