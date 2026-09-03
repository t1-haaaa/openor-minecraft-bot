"use client";
import { useEffect, useState } from "react";

type ProviderHealth = { id: string; name: string; available: boolean; supports247?: boolean; lastError?: string };

export default function Page() {
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [capacity, setCapacity] = useState({ botsUsed: 0, botLimit: 2, executionCapacity: "0/10" });

  useEffect(() => {
    fetch("/api/health").then(r=>r.json()).then(setHealth).catch(()=>{});
    fetch("/api/capacity").then(r=>r.json()).then(setCapacity).catch(()=>{});
  }, []);

  const executionProviders = health.filter(h=> ["self-hosted","container","render-free","koyeb-free","local-agent"].includes(h.id));
  const has247 = executionProviders.some(p=>p.supports247 && p.available);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* Honest availability rule */}
      {!has247 && (
        <div style={{ background: "#7a1f1f", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          24/7 execution unavailable on the current free execution provider.
          <span style={{ opacity: 0.8 }}> — Deploy a Self-Hosted or Container Runner for persistent execution.</span>
        </div>
      )}
      {has247 && (
        <div style={{ background: "#0f4d2a", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          24/7 execution available — persistent ExecutionProvider is active.
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Bots Used" value={String(capacity.botsUsed)} />
        <Stat label="Bot Limit" value={String(capacity.botLimit)} />
        <Stat label="Execution Capacity" value={capacity.executionCapacity} />
        <Stat label="Resource Usage" value="see provider health" />
      </section>

      <section style={{ border: "1px solid #222", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Start Bot (autonomous - no browser keep-alive needed)</h2>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Bot process belongs to the execution layer, not the browser session. Close the browser after Start — bot continues.
          Health checks, reconnect, and crash recovery run server-side.
        </p>
        <form onSubmit={async e=>{
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          const res = await fetch("/api/bots", { method: "POST", body: JSON.stringify(Object.fromEntries((fd as any).entries())), headers: {"Content-Type":"application/json"} });
          const j = await res.json();
          alert(res.ok ? `Bot ${j.id} started on ${j.provider_id}` : `Error: ${j.error}`);
        }} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
          <input name="serverHost" placeholder="server host (e.g. play.example.com)" required style={input} />
          <input name="serverPort" placeholder="25565" defaultValue="25565" style={input} />
          <input name="username" placeholder="bot username" required style={input} />
          <input name="version" placeholder="1.20.1 (optional)" style={input} />
          <button type="submit" style={{ padding: 10, background: "#1a6cff", color: "white", border: 0, borderRadius: 6, cursor: "pointer" }}>Start Bot</button>
        </form>
        <p style={{ fontSize: 12, opacity: 0.5 }}>Secrets are stored server-side only (never in Vercel client / localStorage).</p>
      </section>

      <section style={{ border: "1px solid #222", borderRadius: 8, padding: 16 }}>
        <h3>Provider Health (honest, no fake traffic)</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {health.map(h=> (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: 8, background: "#111", borderRadius: 6, borderLeft: `4px solid ${h.available ? "#1a9c4b" : "#c0392b"}` }}>
              <span>{h.name} {h.supports247 ? "· 24/7" : "· not 24/7"} </span>
              <span style={{ opacity: 0.7, fontSize: 12 }}>{h.available ? "available" : h.lastError ?? "unavailable"}</span>
            </div>
          ))}
          {health.length===0 && <span style={{ opacity: 0.5 }}>Loading health… (GET /api/health proxies via Cloudflare → Openor API)</span>}
        </div>
      </section>

      <footer style={{ marginTop: 24, opacity: 0.5, fontSize: 12 }}>
        Deployment: Vercel (frontend) · Cloudflare (DNS/WAF/CDN/edge) · Supabase (DB/auth/storage) · Execution Layer (Self-Hosted/Container/RemoteVPS)
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "#111", padding: 12, borderRadius: 8, border: "1px solid #222" }}>
    <div style={{ opacity: 0.6, fontSize: 12 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
  </div>;
}
const input: React.CSSProperties = { padding: 10, borderRadius: 6, border: "1px solid #333", background: "#0f0f0f", color: "white" };
