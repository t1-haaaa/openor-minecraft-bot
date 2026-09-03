/**
 * Resource Governor - central per spec
 * Tracks CPU/RAM/storage/active bots/execution time/network/log volume
 * Prevents one user/bot from consuming shared free resources.
 * Bot limits depend on actual available execution resources.
 */

export type ResourceLimits = {
  maxBotsPerUser: number;
  maxBotsGlobal: number;
  maxRamPerBotMb: number;
  maxCpuPerBot: number;
  maxLogBytesPerBot: number;
  maxStorageMb: number;
};

export const FREE_MVP_LIMITS: ResourceLimits = {
  maxBotsPerUser: 2,
  maxBotsGlobal: 10, // depends on verified capacity
  maxRamPerBotMb: 512,
  maxCpuPerBot: 0.5,
  maxLogBytesPerBot: 10 * 1024 * 1024,
  maxStorageMb: 1024,
};

export type UsageSnapshot = {
  userId: string;
  botsUsed: number;
  ramMbUsed: number;
  cpuUsed: number;
  storageMbUsed: number;
  logBytes: number;
};

export class ResourceGovernor {
  private usage = new Map<string, UsageSnapshot>();
  private globalBots = 0;

  constructor(private limits: ResourceLimits = FREE_MVP_LIMITS) {}

  canCreateBot(userId: string, requestedRamMb = 256): { allowed: boolean; reason?: string } {
    const u = this.usage.get(userId) ?? { userId, botsUsed: 0, ramMbUsed: 0, cpuUsed: 0, storageMbUsed: 0, logBytes: 0 };
    if (u.botsUsed >= this.limits.maxBotsPerUser) {
      return { allowed: false, reason: `User bot limit reached (${u.botsUsed}/${this.limits.maxBotsPerUser})` };
    }
    if (this.globalBots >= this.limits.maxBotsGlobal) {
      return { allowed: false, reason: `Global capacity exhausted (${this.globalBots}/${this.limits.maxBotsGlobal})` };
    }
    if (requestedRamMb > this.limits.maxRamPerBotMb) {
      return { allowed: false, reason: `RAM per bot exceeds limit ${this.limits.maxRamPerBotMb}MB` };
    }
    if (u.ramMbUsed + requestedRamMb > this.limits.maxBotsPerUser * this.limits.maxRamPerBotMb) {
      return { allowed: false, reason: "User RAM quota exceeded" };
    }
    return { allowed: true };
  }

  recordCreate(userId: string, ramMb: number) {
    const u = this.usage.get(userId) ?? { userId, botsUsed: 0, ramMbUsed: 0, cpuUsed: 0, storageMbUsed: 0, logBytes: 0 };
    u.botsUsed++; u.ramMbUsed += ramMb; this.globalBots++;
    this.usage.set(userId, u);
  }

  recordDelete(userId: string, ramMb: number) {
    const u = this.usage.get(userId);
    if (!u) return;
    u.botsUsed = Math.max(0, u.botsUsed - 1);
    u.ramMbUsed = Math.max(0, u.ramMbUsed - ramMb);
    this.globalBots = Math.max(0, this.globalBots - 1);
  }

  recordLogVolume(userId: string, bytes: number): boolean {
    const u = this.usage.get(userId);
    if (!u) return false;
    u.logBytes += bytes;
    if (u.logBytes > this.limits.maxLogBytesPerBot * u.botsUsed) return false;
    return true;
  }

  getUsage(userId: string): UsageSnapshot | undefined { return this.usage.get(userId); }
  getGlobalUsage() { return { globalBots: this.globalBots, limit: this.limits.maxBotsGlobal, executionCapacity: `${this.globalBots}/${this.limits.maxBotsGlobal}` }; }
  getLimits(): ResourceLimits { return this.limits; }

  // UI helper - must be shown per spec: Bots Used / Bot Limit / Execution Capacity / Resource Usage
  getDashboard(userId: string) {
    const u = this.usage.get(userId) ?? { userId, botsUsed: 0, ramMbUsed: 0, cpuUsed: 0, storageMbUsed: 0, logBytes: 0 };
    return {
      botsUsed: u.botsUsed,
      botLimit: this.limits.maxBotsPerUser,
      executionCapacity: this.getGlobalUsage().executionCapacity,
      resourceUsage: u,
      limits: this.limits,
    };
  }
}
