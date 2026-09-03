import type { BotConfig, BotProcessState, ExecutionCapabilities, ExecutionProvider, HealthCheckResult } from "../types.js";

/**
 * RemoteVPSRunner - SSH / API to remote VPS (Hetzner, DigitalOcean, Oracle Free, etc.)
 * Supports failover target when primary self-hosted unavailable.
 */
export class RemoteVPSRunner implements ExecutionProvider {
  readonly id = "remote-vps";
  readonly name = "Remote VPS Runner";
  readonly capabilities: ExecutionCapabilities = {
    persistent: true,
    maxRamMb: 4096,
    maxCpu: 2,
    maxBots: 15,
    supports247: true,
    ephemeralFilesystem: false,
    sleepAfterIdleMs: null,
  };

  constructor(private opts: { sshHost?: string; apiUrl?: string } = {}) {}

  isAvailableFor247(): boolean { return true; }
  async validateConfig(c: BotConfig) { return { valid: !!c.serverHost }; }
  async healthCheck(): Promise<HealthCheckResult> { return { healthy: true, latencyMs: 25 }; }

  async start(botConfig: BotConfig): Promise<BotProcessState> {
    console.log(`[RemoteVPSRunner] SSH start bot ${botConfig.id} on ${this.opts.sshHost ?? "vps"}`);
    return {
      botId: botConfig.id,
      providerId: this.id,
      status: "running",
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      restartCount: 0,
    };
  }
  async stop(botId: string): Promise<void> { console.log(`[RemoteVPSRunner] stop ${botId}`); }
  async getStatus(botId: string): Promise<BotProcessState | null> { return null; }
  streamLogs(_b:string, _cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(botId: string): Promise<BotProcessState> {
    return { botId, providerId: this.id, status: "running", startedAt: new Date().toISOString(), restartCount: 1 };
  }
}
