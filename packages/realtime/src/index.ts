/**
 * Real-time architecture:
 * Browser <-> Realtime service <-> Backend <-> Bot Process
 * Bot lifetime NOT dependent on browser WS. On reconnect: load persisted state + replay events + restore monitoring.
 */

export type BotEvent = {
  botId: string;
  type: "status" | "log" | "metric" | "error" | "heartbeat";
  payload: any;
  at: string;
};

export interface RealtimeAdapter {
  publish(event: BotEvent): Promise<void>;
  subscribe(botId: string, cb: (e: BotEvent) => void): { unsubscribe: () => void };
  getHistory(botId: string, limit?: number): Promise<BotEvent[]>;
}

// Supabase Realtime adapter (broadcast/channel)
export class SupabaseRealtimeAdapter implements RealtimeAdapter {
  private history = new Map<string, BotEvent[]>();
  private listeners = new Map<string, Set<(e:BotEvent)=>void>>();

  constructor(private supabaseUrl?: string, private anonKey?: string) {}

  async publish(event: BotEvent): Promise<void> {
    const arr = this.history.get(event.botId) ?? [];
    arr.push(event);
    if (arr.length > 500) arr.shift();
    this.history.set(event.botId, arr);
    const set = this.listeners.get(event.botId);
    if (set) for (const fn of set) fn(event);
    // In prod: supabase.channel(`bot:${event.botId}`).send({type:'broadcast', event: event.type, payload: event})
  }

  subscribe(botId: string, cb: (e: BotEvent)=>void) {
    const set = this.listeners.get(botId) ?? new Set();
    set.add(cb);
    this.listeners.set(botId, set);
    // replay last 50 events for newly connected browser (spec: replay relevant events)
    const hist = this.history.get(botId) ?? [];
    for (const e of hist.slice(-50)) cb(e);
    return { unsubscribe: () => set.delete(cb) };
  }

  async getHistory(botId: string, limit = 100): Promise<BotEvent[]> {
    return (this.history.get(botId) ?? []).slice(-limit);
  }
}

// Browser hook helper (for apps/web)
export const realtimeChannel = (botId: string) => `bot:${botId}`;
