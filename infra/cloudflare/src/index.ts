/**
 * Cloudflare Workers - edge/orchestration layer only
 * Responsibilities: DNS/CDN/WAF/DDoS, edge routing, lightweight API, webhooks, rate limiting, filtering
 * NEVER run Minecraft bot process here. 10ms CPU time cannot sustain persistent connection.
 */

export interface Env {
  OPENOR_API_URL: string;
  RATE_LIMIT_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Rate limiting - 100 req/min per IP at edge (honest quota enforcement)
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const key = `rl:${ip}:${Math.floor(Date.now()/60000)}`;
    const count = Number(await env.RATE_LIMIT_KV.get(key) || "0");
    if (count > 100) return new Response("Rate limited", { status: 429 });
    await env.RATE_LIMIT_KV.put(key, String(count+1), { expirationTtl: 60 });

    // Request filtering - block obvious abuse
    if (url.pathname.includes("..") || url.pathname.length > 2048) return new Response("Bad request", { status: 400 });

    // Lightweight API endpoints that can live at edge (no bot state)
    if (url.pathname === "/edge/health") {
      return Response.json({ edge: "ok", at: new Date().toISOString(), note: "Workers are edge only - not execution host" });
    }

    if (url.pathname === "/edge/webhook" && request.method === "POST") {
      // webhook forwarding to Openor API
      const body = await request.text();
      await fetch(`${env.OPENOR_API_URL}/webhooks`, { method: "POST", body, headers: { "Content-Type": "application/json" } }).catch(()=>{});
      return Response.json({ received: true });
    }

    // All bot operations proxy to Openor API (which talks to real ExecutionProvider)
    const target = `${env.OPENOR_API_URL}${url.pathname}${url.search}`;
    const proxied = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
    });

    // Add security headers (WAF/CDN)
    const res = new Response(proxied.body, proxied);
    res.headers.set("X-Edge", "cloudflare");
    res.headers.set("X-Execution-Note", "Bots run on Execution Layer, not Workers");
    return res;
  }
};
