import type { ExecutionProvider } from "./types.js";
import { SelfHostedRunner } from "./runners/SelfHostedRunner.js";
import { ContainerRunner } from "./runners/ContainerRunner.js";
import { RemoteVPSRunner } from "./runners/RemoteVPSRunner.js";
import { CloudSandboxRunner } from "./runners/CloudSandboxRunner.js";
import { LocalAgentRunner } from "./runners/LocalAgentRunner.js";
import {
  VercelRunner, CloudflareWorkersRunner, RenderFreeRunner, KoyebFreeRunner, SupabaseRunner
} from "./runners/UnsuitableProviders.js";

export type ProviderFactoryOpts = {
  selfHosted?: boolean;
  remoteVps?: { sshHost?: string; apiUrl?: string };
};

const REGISTRY = {
  "self-hosted": () => new SelfHostedRunner(),
  "container": () => new ContainerRunner(),
  "remote-vps": (o?: ProviderFactoryOpts) => new RemoteVPSRunner(o?.remoteVps),
  "cloud-sandbox": () => new CloudSandboxRunner(),
  "local-agent": () => new LocalAgentRunner(),
  // unsuitable - exposed for health dashboard but blocked for start
  "vercel": () => new VercelRunner(),
  "cloudflare-workers": () => new CloudflareWorkersRunner(),
  "render-free": () => new RenderFreeRunner(),
  "koyeb-free": () => new KoyebFreeRunner(),
  "supabase": () => new SupabaseRunner(),
} as const;

export type ProviderKey = keyof typeof REGISTRY;

export function createProvider(key: ProviderKey, opts?: ProviderFactoryOpts): ExecutionProvider {
  const factory = (REGISTRY as any)[key];
  if (!factory) throw new Error(`Unknown provider ${key}`);
  return factory(opts);
}

export function listProviders(): ProviderKey[] {
  return Object.keys(REGISTRY) as ProviderKey[];
}

export function list247CapableProviders(): ProviderKey[] {
  return listProviders().filter(k => createProvider(k).isAvailableFor247());
}

export function getHonestAvailabilityMessage(provider: ExecutionProvider): string {
  if (provider.isAvailableFor247()) return "24/7 execution available";
  return "24/7 execution unavailable on the current free execution provider.";
}
