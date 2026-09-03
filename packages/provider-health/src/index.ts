/**
 * Provider Health monitoring - tracks availability, quota, rate limits, storage, compute, capacity, API failures
 * Exposes accurate provider status (no faking).
 */

export type ProviderHealth = {
  id: string;
  name: string;
  layer: "frontend" | "edge" | "database" | "storage" | "realtime" | "execution" | "monitoring" | "integration";
  available: boolean;
  latencyMs?: number;
  quotaUsed?: number;
  quotaLimit?: number;
  rateLimitRemaining?: number;
  storageUsedMb?: number;
  computeUsedPercent?: number;
  executionCapacity?: string;
  lastChecked: string;
  lastError?: string;
  supports247?: boolean;
};

export class ProviderHealthMonitor {
  private health = new Map<string, ProviderHealth>();
  private failures = new Map<string, number>();

  constructor(initial: ProviderHealth[]) {
    for (const h of initial) this.health.set(h.id, h);
  }

  static defaultHealth(): ProviderHealth[] {
    return [
      { id: "vercel", name: "Vercel", layer: "frontend", available: true, lastChecked: new Date().toISOString(), supports247: false },
      { id: "cloudflare", name: "Cloudflare", layer: "edge", available: true, quotaUsed: 0, quotaLimit: 100000, rateLimitRemaining: 100000, lastChecked: new Date().toISOString(), supports247: false },
      { id: "supabase", name: "Supabase", layer: "database", available: true, quotaUsed: 0, quotaLimit: 50000, storageUsedMb: 0, lastChecked: new Date().toISOString(), supports247: false },
      // execution layer - honest
      { id: "self-hosted", name: "Self-Hosted Runner", layer: "execution", available: true, executionCapacity: "0/20", lastChecked: new Date().toISOString(), supports247: true },
      { id: "container", name: "Container Runner", layer: "execution", available: true, executionCapacity: "0/10", lastChecked: new Date().toISOString(), supports247: true },
      { id: "render-free", name: "Render Free", layer: "execution", available: false, lastChecked: new Date().toISOString(), supports247: false, lastError: "Spins down after 15m, ephemeral FS - dev/preview only" },
      { id: "koyeb-free", name: "Koyeb Free", layer: "execution", available: false, lastChecked: new Date().toISOString(), supports247: false, lastError: "Scales to zero after 1h, 512MB/0.1vCPU" },
    ];
  }

  async check(id: string, checker: () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>) {
    const start = Date.now();
    try {
      const res = await checker();
      const h = this.health.get(id);
      if (!h) return;
      h.available = res.healthy;
      h.latencyMs = res.latencyMs ?? Date.now() - start;
      h.lastChecked = new Date().toISOString();
      h.lastError = res.error;
      if (res.healthy) this.failures.set(id, 0); else this.failures.set(id, (this.failures.get(id) ?? 0) + 1);
    } catch (e:any) {
      const h = this.health.get(id);
      if (h) { h.available = false; h.lastError = e.message; h.lastChecked = new Date().toISOString(); }
      this.failures.set(id, (this.failures.get(id) ?? 0) + 1);
    }
  }

  // call periodically via Cron / monitoring layer
  async checkAll(checkers: Record<string, () => Promise<{ healthy: boolean; latencyMs?: number; error?: string }>>) {
    await Promise.all(Object.entries(checkers).map(([id, fn]) => this.check(id, fn)));
  }

  get(id: string): ProviderHealth | undefined { return this.health.get(id); }
  getAll(): ProviderHealth[] { return [...this.health.values()]; }
  getExecutionProviders(): ProviderHealth[] { return this.getAll().filter(h => h.layer === "execution"); }

  // quota update from API responses
  updateQuota(id: string, used: number, limit: number) {
    const h = this.health.get(id);
    if (h) { h.quotaUsed = used; h.quotaLimit = limit; }
  }

  // failover selection - only 247-capable
  getFailoverTarget(excludeId: string): ProviderHealth | null {
    const candidates = this.getExecutionProviders()
      .filter(h => h.id !== excludeId && h.supports247 && h.available);
    return candidates[0] ?? null;
  }
}
