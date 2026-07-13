import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let cached: string | null | undefined;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeWebhookBase(raw: string): string | null {
  const base = stripQuotes(raw).replace(/\/$/, "");
  return base || null;
}

/** Garante que BITRIX_WEBHOOK_URL esteja disponível no runtime do servidor (dev e deploy). */
export function resolveBitrixWebhookUrl(): string | null {
  if (cached !== undefined) return cached;

  const fromProcess = process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL;
  if (fromProcess?.trim()) {
    cached = normalizeWebhookBase(fromProcess);
    return cached;
  }

  // Vite só injeta VITE_* em import.meta.env; em dev o servidor pode não ver BITRIX_*.
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^BITRIX_WEBHOOK_URL=(.*)$/);
        if (!match) continue;
        const value = normalizeWebhookBase(match[1]);
        if (value) {
          process.env.BITRIX_WEBHOOK_URL = value;
          cached = value;
          return cached;
        }
      }
    }
  } catch {
    // leitura opcional em ambientes sem filesystem
  }

  cached = null;
  return null;
}
