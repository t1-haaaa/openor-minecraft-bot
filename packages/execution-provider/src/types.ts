/**
 * ExecutionProvider abstraction
 * CRITICAL: Vercel, Cloudflare Workers, Supabase, Render Free, Koyeb Free
 * are NOT valid persistent Minecraft hosts. This interface enforces that.
 */

export type BotId = string;
export type ProviderId = string;

export interface BotConfig {
  id: BotId;
  userId: string;
  serverHost: string;
  serverPort: number;
  username: string;
  version?: string;
  // secrets are references, never plaintext in this object when persisted on client
  credentialsRef: string;
  automation?: AutomationRule[];
  schedule?: ScheduleConfig;
}

export interface AutomationRule {
  id: string;
  trigger: string;
  action: string;
}

export interface ScheduleConfig {
  autoStart?: boolean;
  autoReconnect?: boolean;
}

export interface BotProcessState {
  botId: BotId;
  providerId: ProviderId;
  status: "pending" | "starting" | "running" | "stopped" | "crashed" | "reconnecting";
  pid?: number;
  containerId?: string;
  startedAt?: string;
  lastHeartbeatAt?: string;
  restartCount: number;
  lastError?: string;
  resourceUsage?: ResourceUsage;
}

export interface ResourceUsage {
  cpuPercent: number;
  ramMb: number;
  uptimeSec: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ExecutionCapabilities {
  persistent: boolean;
  maxRamMb: number;
  maxCpu: number;
  maxBots: number;
  supports247: boolean;
  ephemeralFilesystem: boolean;
  sleepAfterIdleMs: number | null;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  capabilities: ExecutionCapabilities;
  quota?: { used: number; limit: number };
}

export interface ExecutionProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ExecutionCapabilities;

  // honest availability - must return false for unsuitable free-tier
  isAvailableFor247(): boolean;

  validateConfig(config: BotConfig): Promise<{ valid: boolean; errors?: string[] }>;
  start(botConfig: BotConfig): Promise<BotProcessState>;
  stop(botId: BotId): Promise<void>;
  getStatus(botId: BotId): Promise<BotProcessState | null>;
  healthCheck(): Promise<HealthCheckResult>;
  streamLogs(botId: BotId, cb: (line: string) => void): { close: () => void };
  restart(botId: BotId): Promise<BotProcessState>;
}
