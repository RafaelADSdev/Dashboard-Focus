import { createServerFn } from "@tanstack/react-start";
import { getCache } from "@vercel/functions";
import { resolveBitrixWebhookUrl } from "@/lib/bitrix-env";
import {
  fetchDepartments,
  fetchDealStages,
  fetchDealsInYear,
  fetchUsers,
  getWebhookBase,
  hasBitrixWebhook,
  isCreatedInYear,
  resolvePhotoUrl,
  userDisplayName,
  type BitrixDepartment,
  type BitrixLead,
  type BitrixStatus,
  type BitrixUser,
} from "@/lib/bitrix";
import { mapStageToPhase, type Phase } from "@/lib/phases";
import {
  MONTHS,
  STATIC_TEAMS,
  TEAM_LEADER_NAMES,
  normalizeMemberName,
  type Member,
  type MonthKey,
  type Team,
} from "@/lib/teams-data";

export type DashboardPayload = {
  source: "bitrix" | "unavailable";
  year: number;
  teams: Team[];
  dealCount?: number;
  error?: string;
};

const YEAR = 2026;
const DEAL_CATEGORY_ID = 16;
const DASHBOARD_CACHE_KEY = `dashboard:${YEAR}:category:${DEAL_CATEGORY_ID}`;
const FRESH_CACHE_MS = 15 * 60 * 1_000;
const STALE_CACHE_MS = 6 * 60 * 60 * 1_000;
const CACHE_OPERATION_TIMEOUT_MS = 1_500;

type DashboardCacheEntry = {
  cachedAt: number;
  payload: DashboardPayload;
};

let memoryCache: DashboardCacheEntry | undefined;
let dashboardRequest: Promise<DashboardPayload> | undefined;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Tempo limite do cache excedido")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const TARGET_DEPARTMENTS = [
  { teamId: "elite", departmentName: "Focus Elite" },
  { teamId: "lider", departmentName: "Focus Líder" },
  { teamId: "total", departmentName: "Focus Total" },
] as const;

function normalizeName(value: string): string {
  return normalizeMemberName(value);
}

function monthFromDate(iso: string | undefined): MonthKey | null {
  if (!isCreatedInYear(iso, YEAR)) return null;
  // Usa o mês textual enviado pelo Bitrix para não deslocar a data pelo fuso do servidor.
  const match = String(iso).match(/^\d{4}-(\d{2})/);
  if (!match) return null;
  const key = match[1] as MonthKey;
  return (MONTHS as readonly string[]).includes(key) ? key : null;
}

function userDepartmentIds(user: BitrixUser): string[] {
  const value = user.UF_DEPARTMENT;
  if (value == null || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
}

/** Mapeia os três departamentos Focus e todos os seus descendentes para as abas do painel. */
function departmentTeamMap(departments: BitrixDepartment[]): Map<string, string> {
  const byId = new Map(departments.map((d) => [String(d.ID), d]));
  const direct = new Map<string, string>();

  for (const target of TARGET_DEPARTMENTS) {
    const normalizedTarget = normalizeName(target.departmentName);
    for (const department of departments) {
      if (normalizeName(department.NAME) === normalizedTarget) {
        direct.set(String(department.ID), target.teamId);
      }
    }
  }

  const missing = TARGET_DEPARTMENTS.filter(
    (target) =>
      !departments.some(
        (department) => normalizeName(department.NAME) === normalizeName(target.departmentName),
      ),
  );
  if (missing.length) {
    throw new Error(
      `Departamento(s) não encontrado(s) no Bitrix: ${missing
        .map((target) => target.departmentName)
        .join(", ")}`,
    );
  }

  const resolved = new Map<string, string>();
  const resolveTeam = (departmentId: string, seen = new Set<string>()): string | undefined => {
    if (direct.has(departmentId)) return direct.get(departmentId);
    if (resolved.has(departmentId)) return resolved.get(departmentId);
    if (seen.has(departmentId)) return undefined;
    seen.add(departmentId);

    const parent = byId.get(departmentId)?.PARENT;
    if (parent == null || String(parent) === "0") return undefined;
    const teamId = resolveTeam(String(parent), seen);
    if (teamId) resolved.set(departmentId, teamId);
    return teamId;
  };

  for (const departmentId of byId.keys()) {
    const teamId = resolveTeam(departmentId);
    if (teamId) resolved.set(departmentId, teamId);
  }
  return resolved;
}

function statusMap(statuses: BitrixStatus[], categoryId?: number): Map<string, BitrixStatus> {
  const map = new Map<string, BitrixStatus>();
  for (const s of statuses) {
    if (!s.STATUS_ID) continue;
    map.set(s.STATUS_ID, s);
    // Em pipelines adicionais o deal usa C{categoria}:ETAPA, enquanto crm.status.list
    // pode devolver apenas ETAPA no STATUS_ID.
    if (categoryId && !s.STATUS_ID.startsWith(`C${categoryId}:`)) {
      map.set(`C${categoryId}:${s.STATUS_ID}`, s);
    }
  }
  return map;
}

function phaseForStage(stageId: string, stages: Map<string, BitrixStatus>): Phase {
  const stage = stages.get(stageId);
  const phaseByName = mapStageToPhase(stage?.NAME || stageId);
  if (phaseByName) return phaseByName;

  // Nenhum deal pode desaparecer do total por causa de uma etapa nova ou renomeada.
  const semantic = String(stage?.EXTRA?.SEMANTICS || stage?.SEMANTICS || "").toLowerCase();
  if (semantic === "success" || semantic === "s") return "Contratos Assinados";
  if (semantic === "failure" || semantic === "apology" || semantic === "f") {
    return "Negócios Perdidos";
  }
  return "Em Atendimento";
}

function bump(matrix: Member["matrix"], phase: Phase, month: MonthKey) {
  if (!matrix[phase]) matrix[phase] = {} as Record<MonthKey, number>;
  const row = matrix[phase]!;
  row[month] = (row[month] ?? 0) + 1;
}

function ensureMember(team: Team, name: string, bitrixId?: string, photoUrl?: string): Member {
  const key = normalizeName(name);
  let m = team.members.find((x) => normalizeName(x.name) === key);
  if (!m) {
    m = { name, bitrixId, photoUrl, active: true, matrix: {} };
    team.members.push(m);
  } else {
    if (bitrixId) m.bitrixId = bitrixId;
    if (photoUrl) m.photoUrl = photoUrl;
  }
  return m;
}

function emptyRosterFromStatic(): Team[] {
  return STATIC_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    leader: t.leader ? { ...t.leader } : undefined,
    members: t.members.map((m) => ({
      name: m.name,
      bitrixId: m.bitrixId,
      photoUrl: m.photoUrl,
      active: m.active,
      matrix: {},
    })),
  }));
}

function applyActiveRosterFromBitrix(
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>,
): void {
  const activeByTeam = new Map<string, Set<string>>();
  for (const user of users.values()) {
    if (!activeByTeam.has(user.teamId)) activeByTeam.set(user.teamId, new Set());
    activeByTeam.get(user.teamId)!.add(normalizeName(user.name));
  }

  for (const team of teams) {
    const activeNames = activeByTeam.get(team.id) ?? new Set<string>();
    for (const member of team.members) {
      member.active = activeNames.has(normalizeName(member.name));
    }
  }
}

function seedRosterFromBitrixUsers(
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>,
): void {
  for (const user of users.values()) {
    const team = teams.find((candidate) => candidate.id === user.teamId);
    if (!team) continue;
    const member = ensureMember(team, user.name, user.id, user.photoUrl);
    member.active = true;
  }
}

function ingestItems(
  items: BitrixLead[],
  stages: Map<string, BitrixStatus>,
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>,
): number {
  let ingested = 0;
  for (const item of items) {
    const stageId = item.STATUS_ID || item.STAGE_ID || "";
    const phase = phaseForStage(stageId, stages);

    const month = monthFromDate(item.DATE_CREATE);
    if (!month) continue; // mês fora do ano / sem data → não conta (fica em branco)

    const uid = String(item.ASSIGNED_BY_ID || "");
    const user = users.get(uid);
    if (!user) continue; // somente responsáveis dos três departamentos Focus
    const team = teams.find((candidate) => candidate.id === user.teamId);
    if (!team) continue;
    const member = ensureMember(team, user.name, uid, user.photoUrl);
    bump(member.matrix, phase, month);
    ingested += 1;
  }
  return ingested;
}

async function loadFromBitrix(): Promise<DashboardPayload> {
  const base = getWebhookBase()!;
  const teams = emptyRosterFromStatic();

  // Mantém as consultas sequenciais para respeitar o limite de chamadas do Bitrix.
  const departments = await fetchDepartments();
  const bitrixUsers = await fetchUsers();
  const dealStages = await fetchDealStages(DEAL_CATEGORY_ID);
  const departmentTeams = departmentTeamMap(departments);
  const users = new Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>();

  for (const u of bitrixUsers) {
    const id = String(u.ID);
    const teamId = userDepartmentIds(u)
      .map((departmentId) => departmentTeams.get(departmentId))
      .find((candidate): candidate is string => Boolean(candidate));
    if (!teamId) continue;
    users.set(id, {
      id,
      name: userDisplayName(u) || `Usuário #${id}`,
      photoUrl: resolvePhotoUrl(u.PERSONAL_PHOTO, base),
      teamId,
    });
  }

  for (const team of teams) {
    const leaderName = TEAM_LEADER_NAMES[team.id];
    const leader = [...users.values()].find(
      (candidate) =>
        candidate.teamId === team.id && normalizeName(candidate.name) === normalizeName(leaderName),
    );
    if (!leader) continue;
    team.leader = {
      bitrixId: leader.id,
      name: leader.name,
      photoUrl: leader.photoUrl,
    };
  }

  if (users.size === 0) {
    throw new Error(
      "Nenhum usuário dos departamentos Focus Elite, Focus Líder e Focus Total foi retornado pelo webhook",
    );
  }

  seedRosterFromBitrixUsers(teams, users);
  applyActiveRosterFromBitrix(teams, users);

  if (dealStages.length === 0) {
    throw new Error("Nenhuma etapa foi encontrada para o pipeline Comercial Geral (categoria 16)");
  }

  const deals = await fetchDealsInYear(YEAR, DEAL_CATEGORY_ID, [...users.keys()]);
  const stages = statusMap(dealStages, DEAL_CATEGORY_ID);

  // Preenche IDs/fotos somente no roster do departamento real do usuário.
  for (const user of users.values()) {
    const team = teams.find((candidate) => candidate.id === user.teamId);
    const member = team?.members.find(
      (candidate) => normalizeName(candidate.name) === normalizeName(user.name),
    );
    if (member) {
      member.bitrixId = user.id;
      if (user.photoUrl) {
        member.photoUrl = user.photoUrl;
      }
    }
  }

  const ingestedDeals = ingestItems(deals, stages, teams, users);
  if (ingestedDeals !== deals.length) {
    console.warn(
      `[dashboard] ${deals.length - ingestedDeals} deal(s) ignorado(s) — data inválida ou responsável fora do Focus`,
    );
  }

  return { source: "bitrix", year: YEAR, teams, dealCount: deals.length };
}

function validCacheEntry(value: unknown): value is DashboardCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DashboardCacheEntry>;
  return (
    typeof entry.cachedAt === "number" &&
    Boolean(entry.payload) &&
    entry.payload?.source === "bitrix" &&
    Array.isArray(entry.payload.teams)
  );
}

async function readDashboardCache(): Promise<DashboardCacheEntry | undefined> {
  if (memoryCache && Date.now() - memoryCache.cachedAt <= STALE_CACHE_MS) {
    return memoryCache;
  }

  try {
    const value = await withTimeout(
      getCache({ namespace: "sales-compass" }).get(DASHBOARD_CACHE_KEY),
      CACHE_OPERATION_TIMEOUT_MS,
    );
    if (validCacheEntry(value) && Date.now() - value.cachedAt <= STALE_CACHE_MS) {
      memoryCache = value;
      return value;
    }
  } catch {
    // Fora da Vercel, o cache em memória continua atendendo normalmente.
  }
  return undefined;
}

async function writeDashboardCache(payload: DashboardPayload): Promise<void> {
  const entry: DashboardCacheEntry = { cachedAt: Date.now(), payload };
  memoryCache = entry;

  try {
    await withTimeout(
      getCache({ namespace: "sales-compass" }).set(DASHBOARD_CACHE_KEY, entry, {
        ttl: STALE_CACHE_MS / 1_000,
        tags: ["dashboard-focus", `dashboard-focus-${YEAR}`],
        name: "dashboard-focus-bitrix",
      }),
      CACHE_OPERATION_TIMEOUT_MS,
    );
  } catch {
    // Cache regional indisponível: mantém o cache da instância.
  }
}

async function loadAndCacheDashboard(): Promise<DashboardPayload> {
  if (!dashboardRequest) {
    dashboardRequest = loadFromBitrix();
  }

  try {
    const payload = await dashboardRequest;
    await writeDashboardCache(payload);
    return payload;
  } finally {
    dashboardRequest = undefined;
  }
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPayload> => {
    resolveBitrixWebhookUrl();

    if (!hasBitrixWebhook()) {
      return {
        source: "unavailable",
        year: YEAR,
        teams: emptyRosterFromStatic(),
        error: "BITRIX_WEBHOOK_URL não configurada",
      };
    }

    const cached = await readDashboardCache();
    if (cached && Date.now() - cached.cachedAt <= FRESH_CACHE_MS) {
      return cached.payload;
    }

    try {
      return await loadAndCacheDashboard();
    } catch (e) {
      if (cached) return cached.payload;
      const msg = e instanceof Error ? e.message : "Erro ao consultar Bitrix";
      return { source: "unavailable", year: YEAR, teams: emptyRosterFromStatic(), error: msg };
    }
  },
);
