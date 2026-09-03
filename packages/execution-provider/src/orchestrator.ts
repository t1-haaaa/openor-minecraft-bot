import type { BotConfig, BotProcessState, ExecutionProvider } from "./types.js";
import { createProvider, getHonestAvailabilityMessage, type ProviderKey } from "./factory.js";

/**
 * BotOrchestrator - autonomous operation after Start Bot
 * Handles validate -> create env -> start -> monitor -> reconnect -> restart -> persist
 * Browser independent. Process belongs to execution layer.
 */
export class BotOrchestrator {
  constructor(
    private primaryProviderKey: ProviderKey,
    private fallbackKeys: ProviderKey[] = [],
    private opts: ProviderFactoryOpts = {}
  ) {}

  private get provider(): ExecutionProvider {
    return createProvider(this.primaryProviderKey, this.opts as any);
  }

  // Supports 15-step autonomous flow from spec
  async startBot(config: BotConfig, persist: (s: BotProcessState)=>Promise<void>): Promise<BotProcessState> {
    // 1. validate config
    const v = await this.provider.validateConfig(config);
    if (!v.valid) throw new Error(`Invalid config: ${v.errors?.join(", ")}`);
    // 2. validate permissions (placeholder - integrate with Supabase RLS)
    // 3. create/reuse execution env, 4. prepare deps handled inside provider.start
    // 5. start real bot process
    if (!this.provider.isAvailableFor247()) {
      console.warn(getHonestAvailabilityMessage(this.provider));
      // Zero-cost-first: do NOT fake 24/7, surface honest message but still allow start if caller wants (for dev)
      // For production we throw to force failover
      // throw new Error(getHonestAvailabilityMessage(this.provider));
    }
    const state = await this.provider.start(config);
    // 13. persist state, 12. update dashboard via realtime, 14. notifications handled by caller via persist+events
    await persist(state);
    // 6-11 handled by monitor loop
    this.monitorLoop(config, state, persist);
    return state;
  }

  private async monitorLoop(config: BotConfig, initial: BotProcessState, persist: (s:BotProcessState)=>Promise<void>) {
    let state = initial;
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      try {
        const hc = await this.provider.healthCheck();
        if (!hc.healthy) throw new Error(hc.error);
        const s = await this.provider.getStatus(config.id);
        if (s) {
          state = s;
          state.lastHeartbeatAt = new Date().toISOString();
          await persist(state);
          consecutiveFailures = 0;
        }
        // 7. detect connection, 8. detect crashes handled via status check
      } catch (e:any) {
        consecutiveFailures++;
        console.error(`[monitor] ${config.id} failure ${consecutiveFailures}: ${e.message}`);
        if (consecutiveFailures >= 3) {
          // 9. reconnect, 10. restart with policy
          try {
            state = await this.provider.restart(config.id);
            state.restartCount++;
            await persist(state);
            consecutiveFailures = 0;
          } catch (restartErr:any) {
            //  failover: try fallback provider
            await this.tryFailover(config, persist);
            clearInterval(interval);
          }
        }
      }
    }, 30_000);

    // cleanup when bot stopped externally - caller should clearInterval via return handle in real impl
  }

  private async tryFailover(config: BotConfig, persist: (s:BotProcessState)=>Promise<void>) {
    for (const key of this.fallbackKeys) {
      const p = createProvider(key, this.opts as any);
      if (!p.isAvailableFor247()) continue;
      try {
        console.log(`[failover] trying ${key} for bot ${config.id}`);
        const s = await p.start(config);
        await persist({ ...s, providerId: p.id });
        console.log(`[failover] migrated ${config.id} to ${key}`);
        return;
      } catch (e:any) {
        console.error(`[failover] ${key} failed: ${e.message}`);
      }
    }
    console.error(`[failover] all providers exhausted for ${config.id}`);
  }
}

type ProviderFactoryOpts = { remoteVps?: { sshHost?: string; apiUrl?: string } };
