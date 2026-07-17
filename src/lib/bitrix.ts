/**
 * Cliente Bitrix24 via webhook REST.
 * Configure BITRIX_WEBHOOK_URL=https://SEU.bitrix24.com.br/rest/1/CODIGO/
 */

import { resolveBitrixWebhookUrl } from "@/lib/bitrix-env";

/** Campo personalizado do negócio: "Status do atendimento" (enum) */
export const BITRIX_ATTENDANCE_STATUS_FIELD = "UF_CRM_1717073472";

/** IDs conhecidos do enum "Status do atendimento" (fallback se crm.deal.fields falhar) */
export const BITRIX_ATTENDANCE_STATUS_OPTION_IDS = {
  quarentena: "4128",
  standby: "2104",
} as const;

export type BitrixLead = {
  ID: string;
  TITLE?: string;
  STATUS_ID?: string;
  STAGE_ID?: string;
  CATEGORY_ID?: string;
  ASSIGNED_BY_ID?: string;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  [BITRIX_ATTENDANCE_STATUS_FIELD]?: string | number | BitrixEnumerationValue | null;
};

export type BitrixEnumerationValue = {
  ID?: string | number;
  VALUE?: string;
};

export type BitrixFieldDefinition = {
  type?: string;
  title?: string;
  listLabel?: string;
  formLabel?: string;
  items?: Record<string, BitrixEnumerationValue & { ID: string | number; VALUE: string }>;
};

export type BitrixUser = {
  ID: string;
  ACTIVE?: boolean | string | number;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PERSONAL_PHOTO?: string | number | boolean | null;
  UF_DEPARTMENT?: Array<string | number> | string | number;
};

export type BitrixDepartment = {
  ID: string | number;
  NAME: string;
  PARENT?: string | number;
  UF_HEAD?: string | number;
};

export type BitrixStatus = {
  STATUS_ID: string;
  NAME: string;
  ENTITY_ID?: string;
  SEMANTICS?: string | null;
  EXTRA?: {
    SEMANTICS?: string | null;
  };
};

function webhookBase(): string | null {
  return resolveBitrixWebhookUrl();
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

export function isBitrixUserActive(user: BitrixUser): boolean {
  const value = user.ACTIVE;
  if (value == null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return !["false", "n", "no", "0"].includes(value.trim().toLowerCase());
}

/** Achata params aninhados no formato que o Bitrix REST espera (filter[>=DATE_CREATE]=...) */
function flattenBitrixParams(
  input: Record<string, unknown>,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}[${key}]` : key;
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v != null && typeof v === "object") {
          flattenBitrixParams(v as Record<string, unknown>, `${path}[${i}]`, out);
        } else if (v != null) {
          out[`${path}[${i}]`] = String(v);
        }
      });
    } else if (typeof value === "object") {
      flattenBitrixParams(value as Record<string, unknown>, path, out);
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const BITRIX_REQUEST_INTERVAL_MS = 500;
const BITRIX_REQUEST_TIMEOUT_MS = 8_000;

let bitrixQueue: Promise<void> = Promise.resolve();
let nextBitrixRequestAt = 0;

class BitrixHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status}`);
  }
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function scheduleBitrixRequest<T>(request: () => Promise<T>): Promise<T> {
  const previous = bitrixQueue;
  let release = () => {};
  bitrixQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  const waitMs = Math.max(0, nextBitrixRequestAt - Date.now());
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));

  try {
    return await request();
  } finally {
    nextBitrixRequestAt = Date.now() + BITRIX_REQUEST_INTERVAL_MS;
    release();
  }
}

async function bitrixCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const base = webhookBase();
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  const url = `${base}/${method}`;
  const body = new URLSearchParams(flattenBitrixParams(params));

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await scheduleBitrixRequest(() =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body,
          signal: AbortSignal.timeout(BITRIX_REQUEST_TIMEOUT_MS),
        }),
      );

      if (!res.ok) {
        throw new BitrixHttpError(res.status, retryAfterMs(res.headers.get("retry-after")));
      }

      const json = (await res.json()) as {
        result?: T;
        error?: string;
        error_description?: string;
      };
      if (json.error) {
        throw new Error(json.error_description || json.error);
      }
      return json.result as T;
    } catch (error) {
      lastError = error;
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      const retryableHttp =
        error instanceof BitrixHttpError && (error.status === 429 || error.status >= 500);
      const retryableNetwork = error instanceof TypeError;
      if (attempt >= 2 || timedOut || (!retryableHttp && !retryableNetwork)) break;

      const backoffMs =
        error instanceof BitrixHttpError && error.status === 429
          ? Math.max(error.retryAfterMs ?? 0, 2_000 * 2 ** attempt)
          : 700 * 2 ** attempt;
      const jitterMs = Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const cause =
    lastError instanceof Error && lastError.cause instanceof Error
      ? ` (${lastError.cause.message})`
      : "";
  throw new Error(`Bitrix ${method}: ${message}${cause}`);
}

/** Lista todos os itens paginando (start += 50) */
async function bitrixListAll<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  let previousPageSignature = "";
  for (;;) {
    const batch = await bitrixCall<T[] | { items?: T[] }>(method, {
      ...params,
      start,
    });
    const items = Array.isArray(batch) ? batch : (batch?.items ?? []);
    const pageSignature = items.length
      ? JSON.stringify([items[0], items[items.length - 1]])
      : "empty";
    if (items.length && pageSignature === previousPageSignature) {
      throw new Error(`Bitrix ${method}: a paginação repetiu a mesma página no start ${start}`);
    }
    previousPageSignature = pageSignature;
    all.push(...items);
    if (items.length < 50) break;
    start += 50;
  }
  return all;
}

/**
 * Lista itens do CRM por cursor de ID. O Bitrix pode ignorar offsets altos e
 * repetir a mesma página; filtrar por >ID evita depender desse deslocamento.
 */
async function bitrixListAllById<T extends { ID: string | number }>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const all: T[] = [];
  const baseFilter =
    params.filter && typeof params.filter === "object" && !Array.isArray(params.filter)
      ? (params.filter as Record<string, unknown>)
      : {};
  const baseParams = { ...params };
  delete baseParams.filter;
  delete baseParams.order;
  delete baseParams.start;

  let lastId = "0";
  for (;;) {
    const batch = await bitrixCall<T[] | { items?: T[] }>(method, {
      ...baseParams,
      filter: { ...baseFilter, ">ID": lastId },
      order: { ID: "ASC" },
      start: -1,
    });
    const items = Array.isArray(batch) ? batch : (batch?.items ?? []);
    if (items.length === 0) break;

    let pageLastId = lastId;
    for (const item of items) {
      const itemId = String(item.ID ?? "");
      if (!/^\d+$/.test(itemId) || BigInt(itemId) <= BigInt(pageLastId)) {
        throw new Error(
          `Bitrix ${method}: a paginação por ID não avançou depois do registro ${pageLastId}`,
        );
      }
      pageLastId = itemId;
    }

    all.push(...items);
    if (items.length < 50) break;
    lastId = pageLastId;
  }
  return all;
}

export async function fetchDepartments(): Promise<BitrixDepartment[]> {
  return bitrixListAll<BitrixDepartment>("department.get", { sort: "ID", order: "ASC" });
}

export async function fetchUsers(): Promise<BitrixUser[]> {
  const users = await bitrixListAll<BitrixUser>("user.get", {
    FILTER: { ACTIVE: true },
    sort: "ID",
    order: "ASC",
  });
  return users.filter(isBitrixUserActive);
}

export async function fetchLeadStatuses(): Promise<BitrixStatus[]> {
  // STATUS do CRM lead
  const result = await bitrixCall<BitrixStatus[] | Record<string, BitrixStatus>>(
    "crm.status.list",
    {
      filter: { ENTITY_ID: "STATUS" },
    },
  );
  if (Array.isArray(result)) return result;
  return Object.values(result ?? {});
}

export async function fetchDealStages(categoryId = 0): Promise<BitrixStatus[]> {
  const entityId = categoryId > 0 ? `DEAL_STAGE_${categoryId}` : "DEAL_STAGE";
  const result = await bitrixCall<BitrixStatus[] | Record<string, BitrixStatus>>(
    "crm.status.list",
    {
      filter: { ENTITY_ID: entityId },
    },
  );
  if (Array.isArray(result)) return result;
  return Object.values(result ?? {});
}

export async function fetchDealFields(): Promise<Record<string, BitrixFieldDefinition>> {
  const result = await bitrixCall<Record<string, BitrixFieldDefinition>>("crm.deal.fields");
  return result ?? {};
}

/** ID da opção de lista (enumeration) no Bitrix */
export function resolveEnumerationId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    const value = raw as BitrixEnumerationValue;
    if (value.ID != null && value.ID !== "") return String(value.ID);
    return null;
  }
  return String(raw);
}

/** Intervalo fechado no início e aberto no fim: [year-01-01, year+1-01-01) */
export function yearDateFilter(year: number): Record<string, string> {
  return {
    ">=DATE_CREATE": `${year}-01-01T00:00:00`,
    "<DATE_CREATE": `${year + 1}-01-01T00:00:00`,
  };
}

export function isCreatedInYear(iso: string | undefined, year: number): boolean {
  if (!iso) return false;
  // Bitrix: "2026-03-15T12:00:00+03:00" ou "2026-03-15 12:00:00"
  const m = String(iso).match(/^(\d{4})/);
  if (m) return Number(m[1]) === year;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
}

export async function fetchLeadsInYear(
  year: number,
  assignedByIds?: string[],
): Promise<BitrixLead[]> {
  const assignees = assignedByIds
    ? [...new Set(assignedByIds.map(String).filter(Boolean))]
    : undefined;
  if (assignees && assignees.length === 0) return [];

  const items = await bitrixListAllById<BitrixLead>("crm.lead.list", {
    select: ["ID", "TITLE", "STATUS_ID", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY"],
    filter: {
      ...yearDateFilter(year),
      ...(assignees ? { "@ASSIGNED_BY_ID": assignees } : {}),
    },
  });
  return items.filter((l) => isCreatedInYear(l.DATE_CREATE, year));
}

export async function fetchDealsInYear(
  year: number,
  categoryId?: number,
  assignedByIds?: string[],
): Promise<BitrixLead[]> {
  const assignees = assignedByIds
    ? [...new Set(assignedByIds.map(String).filter(Boolean))]
    : undefined;
  if (assignees && assignees.length === 0) return [];

  const items = await bitrixListAllById<BitrixLead>("crm.deal.list", {
    select: [
      "ID",
      "TITLE",
      "CATEGORY_ID",
      "STAGE_ID",
      "ASSIGNED_BY_ID",
      "DATE_CREATE",
      "DATE_MODIFY",
      BITRIX_ATTENDANCE_STATUS_FIELD,
    ],
    filter: {
      ...yearDateFilter(year),
      ...(categoryId != null ? { CATEGORY_ID: categoryId } : {}),
      ...(assignees ? { "@ASSIGNED_BY_ID": assignees } : {}),
    },
  });
  return items.filter(
    (deal) =>
      isCreatedInYear(deal.DATE_CREATE, year) &&
      (categoryId == null || Number(deal.CATEGORY_ID) === categoryId),
  );
}

/** @deprecated use fetchLeadsInYear */
export async function fetchLeadsSince(year: number): Promise<BitrixLead[]> {
  return fetchLeadsInYear(year);
}

/** @deprecated use fetchDealsInYear */
export async function fetchDealsSince(year: number): Promise<BitrixLead[]> {
  return fetchDealsInYear(year);
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
