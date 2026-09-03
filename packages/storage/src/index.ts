/**
 * Storage strategy - persistent object storage for backups, logs, snapshots
 * Never relies on ephemeral filesystem.
 * Supabase Storage primary (1GB free), migratable to R2/S3.
 */

export interface StorageAdapter {
  put(key: string, data: Buffer | string, contentType?: string): Promise<{ url: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// Supabase Storage adapter
export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private supabaseUrl: string, private serviceKey: string, private bucket = "bot-artifacts") {}

  private url(path: string) { return `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${path}`; }

  async put(key: string, data: Buffer | string, contentType = "application/octet-stream") {
    const res = await fetch(this.url(key), {
      method: "POST",
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: data as any,
    });
    if (!res.ok) throw new Error(`Supabase storage put failed ${res.status}: ${await res.text()}`);
    return { url: this.url(key) };
  }
  async get(key: string) {
    const res = await fetch(this.url(key), {
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` },
    });
    if (!res.ok) throw new Error(`Storage get failed ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async delete(key: string) {
    await fetch(this.url(key), { method: "DELETE", headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` } });
  }
  async list(prefix: string) {
    const res = await fetch(`${this.supabaseUrl}/storage/v1/object/list/${this.bucket}`, {
      method: "POST",
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix }),
    });
    const rows = await res.json();
    return rows.map((r: any) => r.name);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private m = new Map<string, Buffer>();
  async put(key: string, data: Buffer | string) {
    this.m.set(key, Buffer.isBuffer(data) ? data : Buffer.from(data));
    return { url: `memory://${key}` };
  }
  async get(key: string) {
    const v = this.m.get(key); if (!v) throw new Error(`not found ${key}`); return v;
  }
  async delete(key: string) { this.m.delete(key); }
  async list(prefix: string) { return [...this.m.keys()].filter(k => k.startsWith(prefix)); }
}

// helpers for required artifact types
export const artifactKeys = {
  backup: (botId: string, ts: string) => `backups/${botId}/${ts}.json`,
  logs: (botId: string, ts: string) => `logs/${botId}/${ts}.log`,
  snapshot: (botId: string) => `snapshots/${botId}/config.json`,
};
