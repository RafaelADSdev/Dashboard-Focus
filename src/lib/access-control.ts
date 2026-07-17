export const APP_ROLES = [
  { slug: "superintendente", label: "Superintendente" },
  { slug: "administrador", label: "Administrador" },
  { slug: "diretor", label: "Diretor" },
  { slug: "lider", label: "Líder" },
] as const;

export type AppRoleSlug = (typeof APP_ROLES)[number]["slug"];

export const DASHBOARD_PAGES = [
  { key: "overview", label: "Visão Geral" },
  { key: "team:elite", label: "Focus Elite" },
  { key: "team:lider", label: "Focus Líder" },
  { key: "team:total", label: "Focus Total" },
  { key: "team:imparaveis", label: "Imparáveis" },
  { key: "team:domina", label: "Domina" },
  { key: "team:legado", label: "Legado" },
  { key: "team:lobos", label: "Lobos" },
] as const;

export type DashboardPageKey = (typeof DASHBOARD_PAGES)[number]["key"];

const COMERCIAL_PAGE_KEYS = [
  "overview",
  "team:elite",
  "team:lider",
  "team:total",
] as const satisfies readonly DashboardPageKey[];

const ECONOMICO_PAGE_KEYS = [
  "overview",
  "team:imparaveis",
  "team:domina",
  "team:legado",
  "team:lobos",
] as const satisfies readonly DashboardPageKey[];

/** Páginas válidas para a esteira selecionada na gestão de acesso. */
export function dashboardPageKeysForPipeline(
  pipeline: UserPipelineAccessKey,
): readonly DashboardPageKey[] {
  if (pipeline === "ambas") {
    return DASHBOARD_PAGES.map((page) => page.key);
  }
  if (pipeline === "economico") {
    return ECONOMICO_PAGE_KEYS;
  }
  return COMERCIAL_PAGE_KEYS;
}

export function filterPagesForPipelineAccess<
  T extends { key: DashboardPageKey; label: string },
>(pages: T[], pipeline: UserPipelineAccessKey): T[] {
  const allowed = new Set(dashboardPageKeysForPipeline(pipeline));
  return pages.filter((page) => allowed.has(page.key));
}

export function prunePageKeysForPipeline(
  pageKeys: Iterable<DashboardPageKey>,
  pipeline: UserPipelineAccessKey,
): DashboardPageKey[] {
  const allowed = new Set(dashboardPageKeysForPipeline(pipeline));
  return [...pageKeys].filter((key) => allowed.has(key));
}

export const DASHBOARD_PIPELINES = [
  { key: "comercial_geral", label: "Comercial Geral", bitrixCategoryId: 16 },
  { key: "economico", label: "Econômico", bitrixCategoryId: 64 },
] as const;

export type DashboardPipelineKey = (typeof DASHBOARD_PIPELINES)[number]["key"];

export const PIPELINE_ACCESS_MODES = [
  { key: "comercial_geral", label: "Comercial Geral" },
  { key: "economico", label: "Econômico" },
  { key: "ambas", label: "Ambas as esteiras" },
] as const;

export type UserPipelineAccessKey = (typeof PIPELINE_ACCESS_MODES)[number]["key"];

export const DEFAULT_PIPELINE_KEY: DashboardPipelineKey = "comercial_geral";

export type DashboardPipeline = {
  key: UserPipelineAccessKey;
  label: string;
  bitrix_category_id: number;
  sort_order: number;
};

export type AppRole = {
  id: string;
  slug: AppRoleSlug;
  name: string;
  sort_order: number;
};

export type DashboardPage = {
  key: DashboardPageKey;
  label: string;
  sort_order: number;
};

export type RoleRelation = Pick<AppRole, "slug" | "name">;

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string;
  pipeline_key: UserPipelineAccessKey | null;
  app_roles: RoleRelation | RoleRelation[] | null;
};

export function normalizeRoleRelation(
  relation: UserProfile["app_roles"],
): RoleRelation | null {
  if (!relation) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export type ManagedUserAccess = UserProfile & {
  page_keys: DashboardPageKey[];
  pipeline_key: UserPipelineAccessKey;
};

export function teamIdToPageKey(teamId: string): DashboardPageKey | null {
  if (teamId === "overview") return "overview";
  const key = `team:${teamId}` as DashboardPageKey;
  return DASHBOARD_PAGES.some((page) => page.key === key) ? key : null;
}

export function pageKeyToTeamId(pageKey: DashboardPageKey): string {
  if (pageKey === "overview") return "overview";
  return pageKey.replace("team:", "");
}

export function isAdministratorRole(slug: string | undefined | null): boolean {
  return slug === "administrador";
}

export function isPipelineSwitcherRole(slug: string | undefined | null): boolean {
  return slug === "superintendente" || slug === "administrador";
}

export function hasBothPipelinesAccess(
  pipelineKey: UserPipelineAccessKey | null | undefined,
): boolean {
  return pipelineKey === "ambas";
}

export function canUserSwitchPipeline(
  roleSlug: string | null | undefined,
  pipelineKey: UserPipelineAccessKey | null | undefined,
): boolean {
  return isPipelineSwitcherRole(roleSlug) || hasBothPipelinesAccess(pipelineKey);
}

export function normalizeUserPipelineAccess(
  value: string | null | undefined,
): UserPipelineAccessKey {
  if (value === "economico" || value === "ambas") return value;
  return DEFAULT_PIPELINE_KEY;
}

export function pipelineAccessOptions(
  pipelines: Pick<DashboardPipeline, "key" | "label">[] = [],
): { key: UserPipelineAccessKey; label: string }[] {
  const labels = new Map(pipelines.map((pipeline) => [pipeline.key, pipeline.label]));
  return PIPELINE_ACCESS_MODES.map((mode) => ({
    key: mode.key,
    label: labels.get(mode.key) ?? mode.label,
  }));
}

export function resolveDashboardPipeline(
  access: UserPipelineAccessKey,
): DashboardPipelineKey {
  return access === "ambas" ? DEFAULT_PIPELINE_KEY : access;
}

export function getPipelineMeta(key: DashboardPipelineKey) {
  const pipeline = DASHBOARD_PIPELINES.find((item) => item.key === key);
  if (!pipeline) {
    throw new Error(`Pipeline desconhecido: ${key}`);
  }
  return pipeline;
}

export function getPipelineCategoryId(key: DashboardPipelineKey): number {
  return getPipelineMeta(key).bitrixCategoryId;
}

export type PipelineDepartmentTarget = {
  teamId: string;
  teamLabel: string;
  departmentName?: string;
  departmentId?: number;
};

/** IDs conhecidos do departamento raiz FOCUS - PRIMEIRA CHAVE no Bitrix. */
export const PRIMEIRA_CHAVE_ROOT_IDS = [617, 637] as const;

const PRIMEIRA_CHAVE_NAME = /focus\s*-\s*primeira\s*chave/i;

const PIPELINE_DEPARTMENTS: Record<DashboardPipelineKey, PipelineDepartmentTarget[]> = {
  comercial_geral: [
    { teamId: "elite", teamLabel: "Focus Elite", departmentName: "Focus Elite" },
    { teamId: "lider", teamLabel: "Focus Líder", departmentName: "Focus Líder" },
    { teamId: "total", teamLabel: "Focus Total", departmentName: "Focus Total" },
  ],
  economico: [],
};

/** Sub-equipes exibidas no placeholder da esteira Econômico antes do Bitrix carregar. */
export const ECONOMICO_PRIMEIRA_CHAVE_TEAMS: PipelineDepartmentTarget[] = [
  { teamId: "imparaveis", teamLabel: "Imparáveis", departmentName: "IMPARÁVEIS" },
  { teamId: "domina", teamLabel: "Domina", departmentName: "DOMINA" },
  { teamId: "legado", teamLabel: "Legado", departmentName: "LEGADO" },
  { teamId: "lobos", teamLabel: "Lobos", departmentName: "LOBOS" },
];

export const PRIMEIRA_CHAVE_TEAM_IDS = new Set(
  ECONOMICO_PRIMEIRA_CHAVE_TEAMS.map((team) => team.teamId),
);

export function isPrimeiraChaveTeamId(teamId: string): boolean {
  return PRIMEIRA_CHAVE_TEAM_IDS.has(teamId);
}

const FOCUS_MAIN_TEAM_IDS = new Set(["elite", "lider", "total"]);

export function isFocusMainTeamId(teamId: string): boolean {
  return FOCUS_MAIN_TEAM_IDS.has(teamId);
}

export type DiretoriaFilter = "all" | "focus" | "primeira_chave";

export function filterTeamsByDiretoria<T extends { id: string }>(
  teams: T[],
  diretoria: DiretoriaFilter,
): T[] {
  if (diretoria === "all") return teams;
  return diretoria === "focus"
    ? teams.filter((team) => isFocusMainTeamId(team.id))
    : teams.filter((team) => isPrimeiraChaveTeamId(team.id));
}

export function focusMainTeamTabLabel(name: string): string {
  return name.replace(/^Focus\s+/i, "");
}

export function slugifyTeamId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

function normalizeDepartmentKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Mantém IDs estáveis (imparaveis, domina…) mesmo se o nome no Bitrix variar. */
export function teamIdForPrimeiraChaveDepartment(departmentName: string): string {
  const key = normalizeDepartmentKey(departmentName);
  const known = ECONOMICO_PRIMEIRA_CHAVE_TEAMS.find(
    (team) =>
      normalizeDepartmentKey(team.departmentName) === key ||
      normalizeDepartmentKey(team.teamLabel) === key,
  );
  return known?.teamId ?? slugifyTeamId(departmentName);
}

export type BitrixDepartmentLike = {
  ID: string | number;
  NAME: string;
  PARENT?: string | number;
};

export function findPrimeiraChaveRoot(
  departments: BitrixDepartmentLike[],
): BitrixDepartmentLike | null {
  for (const id of PRIMEIRA_CHAVE_ROOT_IDS) {
    const match = departments.find((department) => String(department.ID) === String(id));
    if (match) return match;
  }
  return departments.find((department) => PRIMEIRA_CHAVE_NAME.test(department.NAME)) ?? null;
}

export function buildEconomicoDepartmentTargets(
  departments: BitrixDepartmentLike[],
): PipelineDepartmentTarget[] {
  const root = findPrimeiraChaveRoot(departments);
  if (!root) {
    throw new Error("FOCUS - PRIMEIRA CHAVE não encontrado no Bitrix");
  }

  const rootId = String(root.ID);
  const children = departments
    .filter((department) => String(department.PARENT) === rootId)
    .sort((a, b) => a.NAME.localeCompare(b.NAME, "pt-BR"));

  if (children.length === 0) {
    throw new Error(
      `Nenhuma subequipe encontrada em FOCUS - PRIMEIRA CHAVE (departamento ${rootId})`,
    );
  }

  return children.map((child) => ({
    teamId: teamIdForPrimeiraChaveDepartment(child.NAME),
    teamLabel: child.NAME.trim(),
    departmentId: Number(child.ID),
    departmentName: child.NAME,
  }));
}

export function getEconomicoPlaceholderTargets(): PipelineDepartmentTarget[] {
  return [...ECONOMICO_PRIMEIRA_CHAVE_TEAMS];
}

export function getPipelineDepartments(pipeline: DashboardPipelineKey): PipelineDepartmentTarget[] {
  if (pipeline === "economico") {
    return getEconomicoPlaceholderTargets();
  }
  return PIPELINE_DEPARTMENTS[pipeline];
}

export function getPipelineDepartmentLabels(pipeline: DashboardPipelineKey): string {
  return getPipelineDepartments(pipeline)
    .map((target) => target.teamLabel)
    .join(", ");
}

const COMERCIAL_TEAM_IDS = new Set(["elite", "lider", "total"]);

export function isTeamVisibleInPipeline(teamId: string, pipeline: DashboardPipelineKey): boolean {
  if (teamId === "overview") return true;
  if (pipeline === "comercial_geral") {
    return COMERCIAL_TEAM_IDS.has(teamId);
  }
  return !COMERCIAL_TEAM_IDS.has(teamId);
}

export function getPipelineTeamIds(pipeline: DashboardPipelineKey): string[] {
  return getPipelineDepartments(pipeline).map((target) => target.teamId);
}
