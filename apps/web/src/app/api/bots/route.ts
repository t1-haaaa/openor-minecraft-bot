import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const api = process.env.OPENOR_API_URL || "http://localhost:8787";
  // Secrets must remain server-side: strip any password/token before forwarding, use vault ref
  // Frontend never sends plaintext secrets via NEXT_PUBLIC_ env
  const forwarded = {
    serverHost: body.serverHost,
    serverPort: Number(body.serverPort) || 25565,
    username: body.username,
    version: body.version,
    // In prod: credentialsRef comes from vault after user stored secrets via secure server action
    credentialsRef: body.credentialsRef || `vault:${body.username}`,
  };
  try {
    const res = await fetch(`${api}/bots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(forwarded) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
