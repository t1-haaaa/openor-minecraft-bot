/**
 * Secrets handling - never store plaintext passwords/tokens/API keys in Vercel client / localStorage / repo / logs
 * Secrets remain server-side in vault (Supabase Vault or encrypted bot_configs table)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

export function encryptSecret(plaintext: string, keyB64: string): { blob: string; iv: string } {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([enc, tag]).toString("base64");
  return { blob, iv: iv.toString("base64") };
}

export function decryptSecret(blobB64: string, ivB64: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(blobB64, "base64");
  const tag = data.subarray(data.length - 16);
  const enc = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// Server-side helper: never log the plaintext
export function redactSecrets(obj: Record<string, any>): Record<string, any> {
  const redacted = { ...obj };
  for (const k of ["password", "token", "secret", "apiKey", "credentialsRef"]) {
    if (k in redacted) redacted[k] = "[REDACTED]";
  }
  return redacted;
}
