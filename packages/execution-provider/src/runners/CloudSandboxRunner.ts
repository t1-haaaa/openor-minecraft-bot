import type { BotConfig, BotProcessState, ExecutionCapabilities, ExecutionProvider, HealthCheckResult } from "../types.js";

/**
 * CloudSandboxRunner - E2B / Fly Machines / Railway persistent container style.
 * Provided as FutureProvider example; must be persistent to return supports247=true.
 */
export class CloudSandboxRunner implements ExecutionProvider {
  readonly id = "cloud-sandbox";
  readonly name = "Cloud Sandbox Runner";
  readonly capabilities: ExecutionCapabilities = {
    persistent: true,
    maxRamMb: 1024,
    maxCpu: 1,
    maxBots: 5,
    supports247: true,
    ephemeralFilesystem: false,
    sleepAfterIdleMs: null,
  };
  isAvailableFor247(): boolean { return true; }
  async validateConfig(_c: BotConfig){ return { valid: true }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: true, latencyMs: 30 }; }
  async start(botConfig: BotConfig): Promise<BotProcessState>{
    return { botId: botConfig.id, providerId: this.id, status: "running", startedAt: new Date().toISOString(), lastHeartbeatAt: new Date().toISOString(), restartCount: 0 };
  }
  async stop(_botId: string): Promise<void>{}
  async getStatus(_botId: string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(botId: string): Promise<BotProcessState>{ return { botId, providerId: this.id, status: "running", startedAt: new Date().toISOString(), restartCount: 1 }; }
}
