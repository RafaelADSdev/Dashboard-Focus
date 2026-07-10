/**
 * Cliente Bitrix24 via webhook REST.
 * Configure BITRIX_WEBHOOK_URL=https://SEU.bitrix24.com.br/rest/1/CODIGO/
 */

export type BitrixLead = {
  ID: string;
  TITLE?: string;
  STATUS_ID?: string;
  STAGE_ID?: string;
  ASSIGNED_BY_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
};

export type BitrixUser = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PERSONAL_PHOTO?: string | number | boolean | null;
};

export type BitrixStatus = {
  STATUS_ID: string;
  NAME: string;
  ENTITY_ID?: string;
};

function webhookBase(): string | null {
  const raw =
    (typeof process !== "undefined" && process.env?.BITRIX_WEBHOOK_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_BITRIX_WEBHOOK_URL) ||
    "";
  const base = String(raw).trim().replace(/\/$/, "");
  return base || null;
}

export function hasBitrixWebhook(): boolean {
  return Boolean(webhookBase());
}

function portalOrigin(base: string): string {
  try {
    return new URL(base).origin;
  } catch {
    return "";
  }
}

export function resolvePhotoUrl(
  photo: string | number | boolean | null | undefined,
  base: string,
): string | undefined {
  if (photo === false || photo === true || photo == null || photo === "") return undefined;
  const path = String(photo);
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = portalOrigin(base);
  if (!origin) return undefined;
  return path.startsWith("/") ? `${origin}${path}` : `${origin}/${path}`;
}

export function userDisplayName(u: BitrixUser): string {
  return [u.NAME, u.SECOND_NAME, u.LAST_NAME].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

async function bitrixCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const base = webhookBase();
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  const url = `${base}/${method}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`Bitrix ${method} falhou: HTTP ${res.status}`);
  }

  const json = (await res.json()) as { result?: T; error?: string; error_description?: string };
  if (json.error) {
    throw new Error(`Bitrix ${method}: ${json.error_description || json.error}`);
  }
  return json.result as T;
}

/** Lista todos os itens paginando (start += 50) */
async function bitrixListAll<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  for (;;) {
    const batch = await bitrixCall<T[] | { items?: T[] }>(method, { ...params, start });
    const items = Array.isArray(batch) ? batch : (batch?.items ?? []);
    all.push(...items);
    if (items.length < 50) break;
    start += 50;
    if (start > 5000) break; // safety
  }
  return all;
}

export async function fetchLeadStatuses(): Promise<BitrixStatus[]> {
  // STATUS do CRM lead
  const result = await bitrixCall<BitrixStatus[] | Record<string, BitrixStatus>>("crm.status.list", {
    filter: { ENTITY_ID: "STATUS" },
  });
  if (Array.isArray(result)) return result;
  return Object.values(result ?? {});
}

export async function fetchDealStages(): Promise<BitrixStatus[]> {
  const result = await bitrixCall<BitrixStatus[] | Record<string, BitrixStatus>>("crm.status.list", {
    filter: { ENTITY_ID: "DEAL_STAGE" },
  });
  if (Array.isArray(result)) return result;
  return Object.values(result ?? {});
}

export async function fetchLeadsSince(year: number): Promise<BitrixLead[]> {
  return bitrixListAll<BitrixLead>("crm.lead.list", {
    select: ["ID", "TITLE", "STATUS_ID", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY"],
    filter: { ">=DATE_CREATE": `${year}-01-01T00:00:00` },
    order: { DATE_CREATE: "ASC" },
  });
}

export async function fetchDealsSince(year: number): Promise<BitrixLead[]> {
  return bitrixListAll<BitrixLead>("crm.deal.list", {
    select: ["ID", "TITLE", "STAGE_ID", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY"],
    filter: { ">=DATE_CREATE": `${year}-01-01T00:00:00` },
    order: { DATE_CREATE: "ASC" },
  });
}

export async function fetchUsersByIds(ids: string[]): Promise<Map<string, BitrixUser>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, BitrixUser>();
  if (!unique.length) return map;

  // Busca em lotes via FILTER (mais eficiente que 1 request por usuário)
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const users = await bitrixCall<BitrixUser[]>("user.get", {
        FILTER: { "@ID": chunk.join(",") },
      });
      const list = Array.isArray(users) ? users : [];
      for (const u of list) {
        if (u?.ID) map.set(String(u.ID), u);
      }
    } catch {
      for (const id of chunk) {
        try {
          const user = await bitrixCall<BitrixUser | BitrixUser[]>("user.get", { ID: id });
          const u = Array.isArray(user) ? user[0] : user;
          if (u?.ID) map.set(String(u.ID), u);
        } catch {
          // ignora usuário inacessível
        }
      }
    }
  }
  return map;
}

export function getWebhookBase(): string | null {
  return webhookBase();
}
