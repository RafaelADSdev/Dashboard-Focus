import { getCache, waitUntil } from "@vercel/functions";
import { resolveBitrixWebhookUrl } from "@/lib/bitrix-env";
import {
  BITRIX_ATTENDANCE_STATUS_FIELD,
  BITRIX_ATTENDANCE_STATUS_OPTION_IDS,
  fetchDealFields,
  fetchDepartments,
  fetchDealStages,
  fetchDealsInYear,
  fetchUsers,
  getWebhookBase,
  hasBitrixWebhook,
  isCreatedInYear,
  resolveEnumerationId,
  resolvePhotoUrl,
  userDisplayName,
  type BitrixDepartment,
  type BitrixFieldDefinition,
  type BitrixLead,
  type BitrixStatus,
  type BitrixUser,
} from "@/lib/bitrix";
import {
  DASHBOARD_YEAR,
  createPlaceholderDashboard,
  emptyRosterForPipeline,
  emptyRosterFromTargets,
  type DashboardPayload,
} from "@/lib/dashboard-payload";
import {
  DEFAULT_PIPELINE_KEY,
  buildEconomicoDepartmentTargets,
  getPipelineCategoryId,
  getPipelineDepartmentLabels,
  getPipelineDepartments,
  getPipelineMeta,
  type DashboardPipelineKey,
  type PipelineDepartmentTarget,
} from "@/lib/access-control";
import { isAttendanceStatusPhase, mapStageToPhase, type Phase } from "@/lib/phases";
import {
  MONTHS,
  TEAM_LEADER_NAMES,
  normalizeMemberName,
  type Member,
  type MonthKey,
  type Team,
} from "@/lib/teams-data";

const YEAR = DASHBOARD_YEAR;
const FRESH_CACHE_MS = 15 * 60 * 1_000;
const STALE_CACHE_MS = 6 * 60 * 60 * 1_000;
const CACHE_READ_TIMEOUT_MS = 4_000;
const CACHE_WRITE_TIMEOUT_MS = 2_000;

type DashboardCacheEntry = {
  cachedAt: number;
  payload: DashboardPayload;
};

type PipelineRuntime = {
  memoryCache?: DashboardCacheEntry;
  dashboardRequest?: Promise<DashboardPayload>;
  backgroundRefresh?: Promise<void>;
};

const pipelineRuntime = new Map<DashboardPipelineKey, PipelineRuntime>();

function getPipelineRuntime(pipeline: DashboardPipelineKey): PipelineRuntime {
  const current = pipelineRuntime.get(pipeline);
  if (current) return current;
  const next: PipelineRuntime = {};
  pipelineRuntime.set(pipeline, next);
  return next;
}

function dashboardCacheKey(pipeline: DashboardPipelineKey): string {
  const categoryId = getPipelineCategoryId(pipeline);
  return `dashboard:${YEAR}:category:${categoryId}`;
}

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

function resolveDepartmentTargets(
  departments: BitrixDepartment[],
  pipeline: DashboardPipelineKey,
  targetsOverride?: PipelineDepartmentTarget[],
): Map<string, string> {
  const targets = targetsOverride ?? getPipelineDepartments(pipeline);
  const byId = new Map(departments.map((department) => [String(department.ID), department]));
  const direct = new Map<string, string>();

  for (const target of targets) {
    if (target.departmentId != null) {
      const departmentId = String(target.departmentId);
      if (byId.has(departmentId)) {
        direct.set(departmentId, target.teamId);
      }
    }

    if (target.departmentName) {
      const normalizedTarget = normalizeName(target.departmentName);
      for (const department of departments) {
        if (normalizeName(department.NAME) === normalizedTarget) {
          direct.set(String(department.ID), target.teamId);
        }
      }
    }
  }

  const missing = targets.filter((target) => {
    if (target.departmentId != null && direct.has(String(target.departmentId))) {
      return false;
    }
    if (target.departmentName) {
      return !departments.some(
        (department) => normalizeName(department.NAME) === normalizeName(target.departmentName!),
      );
    }
    return target.departmentId == null || !byId.has(String(target.departmentId));
  });

  if (missing.length) {
    throw new Error(
      `Departamento(s) não encontrado(s) no Bitrix (${getPipelineMeta(pipeline).label}): ${missing
        .map((target) => target.departmentName ?? `ID ${target.departmentId}`)
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

function assignTeamLeaders(
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>,
): void {
  for (const team of teams) {
    const leaderName = TEAM_LEADER_NAMES[team.id];
    if (leaderName) {
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
      continue;
    }

    const teamUsers = [...users.values()].filter((candidate) => candidate.teamId === team.id);
    if (teamUsers.length === 0) continue;
    const leader = teamUsers[0];
    team.leader = {
      bitrixId: leader.id,
      name: leader.name,
      photoUrl: leader.photoUrl,
    };
  }
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

function defaultAttendanceStatusPhaseMap(): Map<string, Phase> {
  return new Map<string, Phase>([
    [BITRIX_ATTENDANCE_STATUS_OPTION_IDS.quarentena, "Em Quarentena"],
    [BITRIX_ATTENDANCE_STATUS_OPTION_IDS.standby, "Standby"],
  ]);
}

function buildAttendanceStatusPhaseMap(
  fields: Record<string, BitrixFieldDefinition>,
): Map<string, Phase> {
  const field = fields[BITRIX_ATTENDANCE_STATUS_FIELD];
  const map = new Map<string, Phase>();
  if (!field?.items) return defaultAttendanceStatusPhaseMap();

  for (const item of Object.values(field.items)) {
    const phase = mapStageToPhase(item.VALUE);
    if (phase && isAttendanceStatusPhase(phase)) {
      map.set(String(item.ID), phase);
    }
  }

  return map.size > 0 ? map : defaultAttendanceStatusPhaseMap();
}

async function resolveAttendanceStatusPhaseMap(): Promise<Map<string, Phase>> {
  try {
    return buildAttendanceStatusPhaseMap(await fetchDealFields());
  } catch (error) {
    console.warn("[dashboard] crm.deal.fields indisponível; usando IDs fixos de Status do atendimento", error);
    return defaultAttendanceStatusPhaseMap();
  }
}

function ingestItems(
  items: BitrixLead[],
  stages: Map<string, BitrixStatus>,
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string; teamId: string }>,
  attendanceStatusById: Map<string, Phase>,
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

    const attendanceId = resolveEnumerationId(item[BITRIX_ATTENDANCE_STATUS_FIELD]);
    const attendancePhase = attendanceId ? attendanceStatusById.get(attendanceId) : null;
    if (attendancePhase) {
      bump(member.matrix, attendancePhase, month);
    }

    ingested += 1;
  }
  return ingested;
}

async function loadFromBitrix(pipeline: DashboardPipelineKey): Promise<DashboardPayload> {
  const pipelineMeta = getPipelineMeta(pipeline);
  const dealCategoryId = pipelineMeta.bitrixCategoryId;
  const base = getWebhookBase()!;

  // Departamentos, usuários e etapas são independentes; o rate limiter do Bitrix serializa as chamadas.
  const [departments, bitrixUsers, dealStages] = await Promise.all([
    fetchDepartments(),
    fetchUsers(),
    fetchDealStages(dealCategoryId),
  ]);

  const departmentTargets =
    pipeline === "economico" ? buildEconomicoDepartmentTargets(departments) : getPipelineDepartments(pipeline);
  const teams = emptyRosterFromTargets(departmentTargets, pipeline);
  const departmentTeams = resolveDepartmentTargets(departments, pipeline, departmentTargets);
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

  assignTeamLeaders(teams, users);

  if (users.size === 0) {
    throw new Error(
      `Nenhum usuário dos departamentos ${getPipelineDepartmentLabels(pipeline)} foi retornado pelo webhook`,
    );
  }

  seedRosterFromBitrixUsers(teams, users);
  applyActiveRosterFromBitrix(teams, users);

  if (dealStages.length === 0) {
    throw new Error(
      `Nenhuma etapa foi encontrada para o pipeline ${pipelineMeta.label} (categoria ${dealCategoryId})`,
    );
  }

  const [deals, attendanceStatusById] = await Promise.all([
    fetchDealsInYear(YEAR, dealCategoryId, [...users.keys()]),
    resolveAttendanceStatusPhaseMap(),
  ]);
  const stages = statusMap(dealStages, dealCategoryId);

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

  const ingestedDeals = ingestItems(deals, stages, teams, users, attendanceStatusById);
  if (ingestedDeals !== deals.length) {
    console.warn(
      `[dashboard] ${deals.length - ingestedDeals} deal(s) ignorado(s) — data inválida ou responsável fora do Focus`,
    );
  }

  return {
    source: "bitrix",
    year: YEAR,
    teams,
    pipeline,
    pipelineLabel: pipelineMeta.label,
    dealCount: deals.length,
  };
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

async function readDashboardCache(pipeline: DashboardPipelineKey): Promise<DashboardCacheEntry | undefined> {
  const runtime = getPipelineRuntime(pipeline);
  if (runtime.memoryCache && Date.now() - runtime.memoryCache.cachedAt <= STALE_CACHE_MS) {
    return runtime.memoryCache;
  }

  const cacheKey = dashboardCacheKey(pipeline);

  try {
    const value = await withTimeout(
      getCache({ namespace: "sales-compass" }).get(cacheKey),
      CACHE_READ_TIMEOUT_MS,
    );
    if (validCacheEntry(value) && Date.now() - value.cachedAt <= STALE_CACHE_MS) {
      runtime.memoryCache = value;
      return value;
    }
  } catch {
    // Fora da Vercel, o cache em memória continua atendendo normalmente.
  }
  return undefined;
}

async function writeDashboardCache(
  pipeline: DashboardPipelineKey,
  payload: DashboardPayload,
): Promise<void> {
  const runtime = getPipelineRuntime(pipeline);
  const entry: DashboardCacheEntry = { cachedAt: Date.now(), payload };
  runtime.memoryCache = entry;
  const cacheKey = dashboardCacheKey(pipeline);

  try {
    await withTimeout(
      getCache({ namespace: "sales-compass" }).set(cacheKey, entry, {
        ttl: STALE_CACHE_MS / 1_000,
        tags: ["dashboard-focus", `dashboard-focus-${YEAR}`, `dashboard-focus-${pipeline}`],
        name: `dashboard-focus-bitrix-${pipeline}`,
      }),
      CACHE_WRITE_TIMEOUT_MS,
    );
  } catch {
    // Cache regional indisponível: mantém o cache da instância.
  }
}

async function loadAndCacheDashboard(pipeline: DashboardPipelineKey): Promise<DashboardPayload> {
  const runtime = getPipelineRuntime(pipeline);
  if (!runtime.dashboardRequest) {
    runtime.dashboardRequest = loadFromBitrix(pipeline);
  }

  try {
    const payload = await runtime.dashboardRequest;
    await writeDashboardCache(pipeline, payload);
    return payload;
  } finally {
    runtime.dashboardRequest = undefined;
  }
}

function scheduleBackgroundRefresh(pipeline: DashboardPipelineKey): void {
  const runtime = getPipelineRuntime(pipeline);
  if (runtime.backgroundRefresh || runtime.dashboardRequest) return;

  runtime.backgroundRefresh = loadAndCacheDashboard(pipeline)
    .then(() => undefined)
    .catch((error) => {
      console.warn(`[dashboard:${pipeline}] atualização em segundo plano falhou:`, error);
    })
    .finally(() => {
      runtime.backgroundRefresh = undefined;
    });

  try {
    waitUntil(runtime.backgroundRefresh);
  } catch {
    void runtime.backgroundRefresh;
  }
}

function unavailablePayload(pipeline: DashboardPipelineKey, error: string): DashboardPayload {
  const pipelineMeta = getPipelineMeta(pipeline);
  return {
    source: "unavailable",
    year: YEAR,
    teams: emptyRosterForPipeline(pipeline),
    pipeline,
    pipelineLabel: pipelineMeta.label,
    error,
  };
}

export async function getDashboardDataImpl(
  pipeline: DashboardPipelineKey = DEFAULT_PIPELINE_KEY,
): Promise<DashboardPayload> {
  resolveBitrixWebhookUrl();

  if (!hasBitrixWebhook()) {
    return unavailablePayload(pipeline, "BITRIX_WEBHOOK_URL não configurada");
  }

  const runtime = getPipelineRuntime(pipeline);
  const cached = await readDashboardCache(pipeline);
  if (cached && Date.now() - cached.cachedAt <= FRESH_CACHE_MS) {
    return cached.payload;
  }

  if (cached) {
    scheduleBackgroundRefresh(pipeline);
    return cached.payload;
  }

  if (runtime.dashboardRequest) {
    try {
      return await runtime.dashboardRequest;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Erro ao consultar Bitrix";
      return unavailablePayload(pipeline, reason);
    }
  }

  scheduleBackgroundRefresh(pipeline);
  return createPlaceholderDashboard(pipeline);
}

export async function warmDashboardCacheHandler(
  pipeline: DashboardPipelineKey = DEFAULT_PIPELINE_KEY,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  resolveBitrixWebhookUrl();
  if (!hasBitrixWebhook()) {
    return { ok: false, reason: "BITRIX_WEBHOOK_URL não configurada" };
  }

  try {
    await loadAndCacheDashboard(pipeline);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erro ao consultar Bitrix";
    console.warn(`[dashboard:${pipeline}] warm cache falhou:`, reason);
    return { ok: false, reason };
  }
}
