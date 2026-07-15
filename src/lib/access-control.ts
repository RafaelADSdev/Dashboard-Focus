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
] as const;

export type DashboardPageKey = (typeof DASHBOARD_PAGES)[number]["key"];

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
