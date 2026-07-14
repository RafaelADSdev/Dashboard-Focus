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

/**
 * Garante que BITRIX_WEBHOOK_URL esteja disponível no runtime do servidor.
 * Em dev, o vite.config copia a variável de .env.local para process.env.
 */
export function resolveBitrixWebhookUrl(): string | null {
  if (cached !== undefined) return cached;

  const fromProcess = process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL;
  if (fromProcess?.trim()) {
    cached = normalizeWebhookBase(fromProcess);
    return cached;
  }

  cached = null;
  return null;
}
