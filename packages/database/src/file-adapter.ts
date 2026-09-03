/**
 * FileAdapter — durable persistence that survives backend & execution host restarts
 * Replaces MemoryAdapter for production-path. Stores to data/db.json with atomic writes.
 * Covers: bots, configs, automation, schedules, profiles, notifications, activities, metrics, recovery state
 */
import fs from "node:fs";
import path from "node:path";
import type { BotRow, EncryptedConfig, ActivityRecord, MetricRow, DatabaseAdapter } from "./index.js";

type Persisted = {
  bots: Record<string, BotRow>;
  configs: Record<string, EncryptedConfig>;
  activities: ActivityRecord[];
  automations: Record<string, any[]>;
  schedules: Record<string, any>;
  profiles: Record<string, any>;
  notifications: any[];
  metrics: Record<string, MetricRow[]>;
};

export class FileAdapter implements DatabaseAdapter {
  private filePath: string;
  private data: Persisted;

  constructor(filePath = path.join(process.cwd(), "data", "db.json")) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        // ensure all keys exist
        this.data.bots = this.data.bots ?? {};
        this.data.configs = this.data.configs ?? {};
        this.data.activities = this.data.activities ?? [];
        this.data.automations = this.data.automations ?? {};
        this.data.schedules = this.data.schedules ?? {};
        this.data.profiles = this.data.profiles ?? {};
        this.data.notifications = this.data.notifications ?? [];
        this.data.metrics = this.data.metrics ?? {};
      } catch {
        this.data = this.empty();
      }
    } else {
      this.data = this.empty();
      this.flush();
    }
  }

  private empty(): Persisted {
    return { bots: {}, configs: {}, activities: [], automations: {}, schedules: {}, profiles: {}, notifications: [], metrics: {} };
  }

  private flush() {
    const tmp = this.filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  async getUser(id: string) { return this.data.profiles[id] ?? null; }
  async listBots(userId: string): Promise<BotRow[]> { return Object.values(this.data.bots).filter(b => b.user_id === userId); }
  async getBot(id: string): Promise<BotRow | null> { return this.data.bots[id] ?? null; }
  async createBot(row: BotRow): Promise<BotRow> { this.data.bots[row.id] = row; this.flush(); return row; }
  async updateBot(id: string, patch: Partial<BotRow>): Promise<BotRow> {
    const cur = this.data.bots[id];
    if (!cur) throw new Error(`bot ${id} not found`);
    const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
    this.data.bots[id] = next; this.flush(); return next;
  }
  async deleteBot(id: string): Promise<void> { delete this.data.bots[id]; this.flush(); }
  async getBotConfig(botId: string): Promise<EncryptedConfig | null> { return this.data.configs[botId] ?? null; }
  // extra for persistence testing
  async saveBotConfig(cfg: EncryptedConfig): Promise<void> { this.data.configs[cfg.bot_id] = cfg; this.flush(); }
  async insertActivity(record: ActivityRecord): Promise<void> { this.data.activities.push(record); this.flush(); }
  async getMetrics(botId: string): Promise<MetricRow[]> { return this.data.metrics[botId] ?? []; }
  async insertMetric(row: MetricRow): Promise<void> {
    if (!this.data.metrics[row.bot_id]) this.data.metrics[row.bot_id] = [];
    this.data.metrics[row.bot_id].push(row); this.flush();
  }
  // additional durable state
  async saveAutomation(botId: string, rule: any): Promise<void> {
    if (!this.data.automations[botId]) this.data.automations[botId] = [];
    this.data.automations[botId].push(rule); this.flush();
  }
  async listAutomations(botId: string): Promise<any[]> { return this.data.automations[botId] ?? []; }
  async saveSchedule(botId: string, sched: any): Promise<void> { this.data.schedules[botId] = sched; this.flush(); }
  async getSchedule(botId: string): Promise<any | null> { return this.data.schedules[botId] ?? null; }
  async saveProfile(id: string, profile: any): Promise<void> { this.data.profiles[id] = profile; this.flush(); }
  async saveNotification(n: any): Promise<void> { this.data.notifications.push(n); this.flush(); }

  // For testing: wipe file
  async clear(): Promise<void> { this.data = this.empty(); this.flush(); }
  getPath(): string { return this.filePath; }
}
