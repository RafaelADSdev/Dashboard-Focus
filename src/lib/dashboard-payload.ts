import type { DashboardPipelineKey, PipelineDepartmentTarget } from "@/lib/access-control";
import { DEFAULT_PIPELINE_KEY, getPipelineDepartments } from "@/lib/access-control";
import { STATIC_TEAMS, TEAM_LEADER_NAMES, type Team } from "@/lib/teams-data";

export type DashboardPayload = {
  source: "bitrix" | "unavailable";
  year: number;
  teams: Team[];
  pipeline?: DashboardPipelineKey;
  pipelineLabel?: string;
  dealCount?: number;
  error?: string;
};

export const DASHBOARD_YEAR = 2026;

/** Incrementar quando a estrutura de fases ou ingestão do payload mudar. */
export const DASHBOARD_DATA_VERSION = "economico-phases-v16";

function rosterMembersForTarget(
  pipeline: DashboardPipelineKey,
  target: PipelineDepartmentTarget,
) {
  if (pipeline === "economico") {
    return [];
  }
  const staticTeam = STATIC_TEAMS.find((team) => team.id === target.teamId);
  return staticTeam?.members ?? [];
}

export function emptyRosterFromTargets(
  targets: PipelineDepartmentTarget[],
  pipeline: DashboardPipelineKey = DEFAULT_PIPELINE_KEY,
): Team[] {
  return targets.map((target) => {
    const leaderName = TEAM_LEADER_NAMES[target.teamId];

    return {
      id: target.teamId,
      name: target.teamLabel,
      leader: leaderName ? { name: leaderName } : undefined,
      members: rosterMembersForTarget(pipeline, target).map((member) => ({
        name: member.name,
        bitrixId: member.bitrixId,
        photoUrl: member.photoUrl,
        active: member.active,
        matrix: {},
      })),
    };
  });
}

export function emptyRosterForPipeline(pipeline: DashboardPipelineKey): Team[] {
  return emptyRosterFromTargets(getPipelineDepartments(pipeline), pipeline);
}

export function emptyRosterFromStatic(): Team[] {
  return emptyRosterForPipeline(DEFAULT_PIPELINE_KEY);
}

export function createPlaceholderDashboard(
  pipeline: DashboardPipelineKey = DEFAULT_PIPELINE_KEY,
): DashboardPayload {
  return {
    source: "unavailable",
    year: DASHBOARD_YEAR,
    teams: emptyRosterForPipeline(pipeline),
    pipeline,
  };
}
