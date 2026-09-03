import type { BotConfig, BotProcessState, ExecutionCapabilities, ExecutionProvider, HealthCheckResult } from "../types.js";

/**
 * LocalAgentRunner - User installs local agent (like Tailscale-style) that polls API and runs bots locally.
 * Useful for zero-cost MVP where user provides own machine, but still decoupled from browser.
 * Honest: supports 24/7 ONLY if user's machine stays on. Platform must report that.
 */
export class LocalAgentRunner implements ExecutionProvider {
  readonly id = "local-agent";
  readonly name = "Local Agent Runner";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, // depends on user's device
    maxRamMb: 2048,
    maxCpu: 1,
    maxBots: 3,
    supports247: false,
    ephemeralFilesystem: false,
    sleepAfterIdleMs: null,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: true }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: true }; }
  async start(botConfig: BotConfig): Promise<BotProcessState>{
    // Enqueue job for agent to pick up via polling
    console.log(`[LocalAgentRunner] enqueued bot ${botConfig.id} for local agent`);
    return { botId: botConfig.id, providerId: this.id, status: "pending", startedAt: new Date().toISOString(), restartCount: 0 };
  }
  async stop(_b:string): Promise<void>{}
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(botId: string): Promise<BotProcessState>{ return { botId, providerId: this.id, status: "pending", startedAt: new Date().toISOString(), restartCount: 1 }; }
}
