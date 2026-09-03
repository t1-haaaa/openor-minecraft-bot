import type { BotConfig, BotProcessState, ExecutionCapabilities, ExecutionProvider, HealthCheckResult } from "../types.js";
import { ProviderNotSuitableError } from "../errors.js";

/**
 * These providers MUST NOT be used for 24/7 per spec.
 * They are included only to make the misuse impossible / explicit.
 * No fake traffic, no keep-alive hacks.
 */

export class VercelRunner implements ExecutionProvider {
  readonly id = "vercel";
  readonly name = "Vercel (NOT for bots)";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, maxRamMb: 1024, maxCpu: 0.5, maxBots: 0,
    supports247: false, ephemeralFilesystem: true, sleepAfterIdleMs: 0,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: false, errors: ["Vercel MUST NOT be used as Minecraft host"] }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: false, error: "Vercel is frontend only" }; }
  async start(_c: BotConfig): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Vercel is serverless/edge frontend only - no persistent process"); }
  async stop(_b:string): Promise<void>{ throw new ProviderNotSuitableError(this.name, "No bot to stop"); }
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(_b:string): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Cannot restart"); }
}

export class CloudflareWorkersRunner implements ExecutionProvider {
  readonly id = "cloudflare-workers";
  readonly name = "Cloudflare Workers (NOT for bots)";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, maxRamMb: 128, maxCpu: 0.1, maxBots: 0,
    supports247: false, ephemeralFilesystem: true, sleepAfterIdleMs: 0,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: false, errors: ["Workers 10ms CPU, 100k req/day - edge/orchestration only"] }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: false, error: "Workers edge only" }; }
  async start(_c: BotConfig): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Workers Free 10ms CPU cannot run persistent Minecraft process"); }
  async stop(_b:string): Promise<void>{ throw new ProviderNotSuitableError(this.name, "No bot"); }
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(_b:string): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Cannot restart"); }
}

export class RenderFreeRunner implements ExecutionProvider {
  readonly id = "render-free";
  readonly name = "Render Free (ephemeral)";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, maxRamMb: 512, maxCpu: 0.5, maxBots: 0,
    supports247: false, ephemeralFilesystem: true, sleepAfterIdleMs: 15*60*1000,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: false, errors: ["Render Free spins down after 15m, ephemeral FS, Postgres expires 30d - dev/preview only"] }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: false, error: "Render Free sleeps" }; }
  async start(_c: BotConfig): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Render Free may spin down after 15m without inbound traffic - not for 24/7"); }
  async stop(_b:string): Promise<void>{ throw new ProviderNotSuitableError(this.name, "No bot"); }
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(_b:string): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Cannot restart"); }
}

export class KoyebFreeRunner implements ExecutionProvider {
  readonly id = "koyeb-free";
  readonly name = "Koyeb Free (scales to zero)";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, maxRamMb: 512, maxCpu: 0.1, maxBots: 0,
    supports247: false, ephemeralFilesystem: true, sleepAfterIdleMs: 60*60*1000,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: false, errors: ["Koyeb Free: 512MB/0.1 vCPU/2GB, scales to zero after 1h, 1 free instance - not for 24/7"] }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: false, error: "Koyeb Free scales to zero" }; }
  async start(_c: BotConfig): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Koyeb Free scales to zero after 1h without traffic"); }
  async stop(_b:string): Promise<void>{ throw new ProviderNotSuitableError(this.name, "No bot"); }
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(_b:string): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Cannot restart"); }
}

export class SupabaseRunner implements ExecutionProvider {
  readonly id = "supabase";
  readonly name = "Supabase (NOT for bots)";
  readonly capabilities: ExecutionCapabilities = {
    persistent: false, maxRamMb: 0, maxCpu: 0, maxBots: 0, supports247: false, ephemeralFilesystem: true, sleepAfterIdleMs: 0,
  };
  isAvailableFor247(): boolean { return false; }
  async validateConfig(_c: BotConfig){ return { valid: false, errors: ["Supabase is DB/auth/storage only"] }; }
  async healthCheck(): Promise<HealthCheckResult>{ return { healthy: false, error: "Supabase is DB only" }; }
  async start(_c: BotConfig): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Supabase cannot run Minecraft processes"); }
  async stop(_b:string): Promise<void>{ throw new ProviderNotSuitableError(this.name, "No bot"); }
  async getStatus(_b:string): Promise<BotProcessState | null>{ return null; }
  streamLogs(_b:string,_cb:(l:string)=>void){ return { close:()=>{} }; }
  async restart(_b:string): Promise<BotProcessState>{ throw new ProviderNotSuitableError(this.name, "Cannot restart"); }
}
