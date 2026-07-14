import { STATIC_TEAMS, type Team } from "@/lib/teams-data";

export type DashboardPayload = {
  source: "bitrix" | "unavailable";
  year: number;
  teams: Team[];
  dealCount?: number;
  error?: string;
};

export const DASHBOARD_YEAR = 2026;

export function emptyRosterFromStatic(): Team[] {
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

export function createPlaceholderDashboard(): DashboardPayload {
  return {
    source: "unavailable",
    year: DASHBOARD_YEAR,
    teams: emptyRosterFromStatic(),
  };
}
