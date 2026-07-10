import { createServerFn } from "@tanstack/react-start";
import {
  fetchDealStages,
  fetchDealsSince,
  fetchLeadStatuses,
  fetchLeadsSince,
  fetchUsersByIds,
  getWebhookBase,
  hasBitrixWebhook,
  resolvePhotoUrl,
  userDisplayName,
  type BitrixLead,
  type BitrixStatus,
} from "@/lib/bitrix";
import { mapStageToPhase, type Phase } from "@/lib/phases";
import {
  MONTHS,
  STATIC_TEAMS,
  type Member,
  type MonthKey,
  type Team,
} from "@/lib/teams-data";

export type DashboardPayload = {
  source: "bitrix" | "static";
  year: number;
  teams: Team[];
  error?: string;
};

const YEAR = 2026;

function monthFromDate(iso: string | undefined): MonthKey | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== YEAR) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return (MONTHS as readonly string[]).includes(m) ? (m as MonthKey) : null;
}

function statusMap(statuses: BitrixStatus[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of statuses) {
    if (s.STATUS_ID) map.set(s.STATUS_ID, s.NAME);
  }
  return map;
}

function bump(
  matrix: Member["matrix"],
  phase: Phase,
  month: MonthKey,
) {
  if (!matrix[phase]) matrix[phase] = {} as Record<MonthKey, number>;
  const row = matrix[phase]!;
  row[month] = (row[month] ?? 0) + 1;
}

function findTeamForName(name: string, teams: Team[]): Team {
  const n = name.toLowerCase();
  for (const t of teams) {
    if (t.members.some((m) => m.name.toLowerCase() === n)) return t;
  }
  // fallback: Focus Total
  return teams.find((t) => t.id === "total") ?? teams[0];
}

function emptyRosterFromStatic(): Team[] {
  return STATIC_TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      name: m.name,
      bitrixId: m.bitrixId,
      photoUrl: m.photoUrl,
      matrix: {},
    })),
  }));
}

function ensureMember(team: Team, name: string, bitrixId?: string, photoUrl?: string): Member {
  let m = team.members.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!m) {
    m = { name, bitrixId, photoUrl, matrix: {} };
    team.members.push(m);
  } else {
    if (bitrixId) m.bitrixId = bitrixId;
    if (photoUrl) m.photoUrl = photoUrl;
  }
  return m;
}

function ingestItems(
  items: BitrixLead[],
  idToName: Map<string, string>,
  teams: Team[],
  users: Map<string, { name: string; photoUrl?: string; id: string }>,
) {
  for (const item of items) {
    const stageId = item.STATUS_ID || item.STAGE_ID || "";
    const stageName = idToName.get(stageId) || stageId;
    const phase = mapStageToPhase(stageName);
    if (!phase) continue;

    const month = monthFromDate(item.DATE_CREATE);
    if (!month) continue; // mês fora do ano / sem data → não conta (fica em branco)

    const uid = String(item.ASSIGNED_BY_ID || "");
    const user = users.get(uid);
    const name = user?.name || (uid ? `Usuário #${uid}` : "Sem responsável");
    const team = findTeamForName(name, teams);
    const member = ensureMember(team, name, uid || undefined, user?.photoUrl);
    bump(member.matrix, phase, month);
  }
}

async function loadFromBitrix(): Promise<DashboardPayload> {
  const base = getWebhookBase()!;
  const teams = emptyRosterFromStatic();

  const [leads, deals, leadStatuses, dealStages] = await Promise.all([
    fetchLeadsSince(YEAR).catch(() => [] as BitrixLead[]),
    fetchDealsSince(YEAR).catch(() => [] as BitrixLead[]),
    fetchLeadStatuses().catch(() => [] as BitrixStatus[]),
    fetchDealStages().catch(() => [] as BitrixStatus[]),
  ]);

  const idToName = new Map<string, string>([
    ...statusMap(leadStatuses),
    ...statusMap(dealStages),
  ]);

  const assigneeIds = [
    ...leads.map((l) => String(l.ASSIGNED_BY_ID || "")),
    ...deals.map((d) => String(d.ASSIGNED_BY_ID || "")),
  ];

  const bitrixUsers = await fetchUsersByIds(assigneeIds);
  const users = new Map<string, { name: string; photoUrl?: string; id: string }>();
  for (const [id, u] of bitrixUsers) {
    users.set(id, {
      id,
      name: userDisplayName(u) || `Usuário #${id}`,
      photoUrl: resolvePhotoUrl(u.PERSONAL_PHOTO, base),
    });
  }

  // Preenche fotos nos membros do roster estático quando o nome bate
  for (const t of teams) {
    for (const m of t.members) {
      for (const u of users.values()) {
        if (u.name.toLowerCase() === m.name.toLowerCase()) {
          m.bitrixId = u.id;
          m.photoUrl = u.photoUrl;
        }
      }
    }
  }

  ingestItems(leads, idToName, teams, users);
  ingestItems(deals, idToName, teams, users);

  return { source: "bitrix", year: YEAR, teams };
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPayload> => {
    if (!hasBitrixWebhook()) {
      return { source: "static", year: YEAR, teams: STATIC_TEAMS };
    }
    try {
      return await loadFromBitrix();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar Bitrix";
      return { source: "static", year: YEAR, teams: STATIC_TEAMS, error: msg };
    }
  },
);
