/**
 * Database abstraction - prevents provider lock-in
 * Primary MVP: Supabase PostgreSQL
 * Future: managed PG, self-hosted PG, etc.
 * Stores: users, profiles, bots, servers, configs, automation, schedules, notifications, activity, audit, metrics, backup meta, API config
 * Never stores raw Minecraft process state as sole truth; never stores plaintext secrets.
 */

export interface DatabaseAdapter {
  // users/profiles
  getUser(id: string): Promise<any>;
  // bots
  listBots(userId: string): Promise<BotRow[]>;
  getBot(id: string): Promise<BotRow | null>;
  createBot(row: BotRow): Promise<BotRow>;
  updateBot(id: string, patch: Partial<BotRow>): Promise<BotRow>;
  deleteBot(id: string): Promise<void>;
  // configs stored as encrypted ref
  getBotConfig(botId: string): Promise<EncryptedConfig | null>;
  // audit/metrics
  insertActivity(record: ActivityRecord): Promise<void>;
  getMetrics(botId: string): Promise<MetricRow[]>;
}

export type BotRow = {
  id: string;
  user_id: string;
  server_host: string;
  server_port: number;
  username: string;
  version?: string;
  provider_id: string;
  status: string;
  config_ref: string; // points to vault, not plaintext
  created_at: string;
  updated_at: string;
};

export type EncryptedConfig = {
  bot_id: string;
  encrypted_blob: string; // AES-GCM encrypted
  iv: string;
  updated_at: string;
};

export type ActivityRecord = {
  id: string;
  bot_id: string;
  user_id: string;
  event: string;
  created_at: string;
};

export type MetricRow = {
  bot_id: string;
  cpu: number;
  ram_mb: number;
  at: string;
};

// Supabase implementation - thin wrapper, replaceable
export class SupabaseAdapter implements DatabaseAdapter {
  constructor(private supabaseUrl: string, private serviceRoleKey: string) {}

  private async q(path: string, init?: RequestInit) {
    const res = await fetch(`${this.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Supabase ${path} ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getUser(id: string) { return this.q(`profiles?id=eq.${id}`); }
  async listBots(userId: string): Promise<BotRow[]> { return this.q(`bots?user_id=eq.${userId}`); }
  async getBot(id: string): Promise<BotRow | null> {
    const rows = await this.q(`bots?id=eq.${id}`);
    return rows[0] ?? null;
  }
  async createBot(row: BotRow): Promise<BotRow> {
    const rows = await this.q("bots", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } as any });
    return rows[0] ?? row;
  }
  async updateBot(id: string, patch: Partial<BotRow>): Promise<BotRow> {
    const rows = await this.q(`bots?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } as any });
    return rows[0];
  }
  async deleteBot(id: string): Promise<void> { await this.q(`bots?id=eq.${id}`, { method: "DELETE" }); }
  async getBotConfig(botId: string): Promise<EncryptedConfig | null> {
    const rows = await this.q(`bot_configs?bot_id=eq.${botId}`);
    return rows[0] ?? null;
  }
  async insertActivity(record: ActivityRecord): Promise<void> {
    await this.q("activity", { method: "POST", body: JSON.stringify(record) });
  }
  async getMetrics(botId: string): Promise<MetricRow[]> { return this.q(`metrics?bot_id=eq.${botId}&order=at.desc&limit=100`); }
}

// In-memory adapter for tests/dev
export class MemoryAdapter implements DatabaseAdapter {
  private bots = new Map<string, BotRow>();
  private configs = new Map<string, EncryptedConfig>();
  private activities: ActivityRecord[] = [];
  async getUser(_id: string) { return null; }
  async listBots(userId: string) { return [...this.bots.values()].filter(b => b.user_id === userId); }
  async getBot(id: string) { return this.bots.get(id) ?? null; }
  async createBot(row: BotRow) { this.bots.set(row.id, row); return row; }
  async updateBot(id: string, patch: Partial<BotRow>) {
    const cur = this.bots.get(id)!; const next = { ...cur, ...patch }; this.bots.set(id, next); return next;
  }
  async deleteBot(id: string) { this.bots.delete(id); }
  async getBotConfig(botId: string) { return this.configs.get(botId) ?? null; }
  async insertActivity(r: ActivityRecord) { this.activities.push(r); }
  async getMetrics(_botId: string) { return []; }
}

export { FileAdapter } from "./file-adapter.js";
