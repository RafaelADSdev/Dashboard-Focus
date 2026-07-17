import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DASHBOARD_PAGES,
  DASHBOARD_PIPELINES,
  DEFAULT_PIPELINE_KEY,
  canUserSwitchPipeline,
  isAdministratorRole,
  normalizeRoleRelation,
  normalizeUserPipelineAccess,
  resolveDashboardPipeline,
  teamIdToPageKey,
  type AppRole,
  type DashboardPage,
  type DashboardPageKey,
  type DashboardPipeline,
  type DashboardPipelineKey,
  type UserPipelineAccessKey,
  type ManagedUserAccess,
  type UserProfile,
} from "@/lib/access-control";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { createUserAccessFn } from "@/lib/create-user-access";
import { deleteUserAccessFn } from "@/lib/delete-user-access";

type AccessContextValue = {
  loading: boolean;
  ready: boolean;
  setupRequired: boolean;
  pipelineMigrationPending: boolean;
  profile: UserProfile | null;
  roleSlug: string | null;
  isAdministrator: boolean;
  allowedPages: DashboardPageKey[];
  allowedPipeline: UserPipelineAccessKey;
  canSwitchPipeline: boolean;
  pipelines: DashboardPipeline[];
  pages: DashboardPage[];
  roles: AppRole[];
  canAccessPage: (pageKey: DashboardPageKey) => boolean;
  canAccessTeam: (teamId: string) => boolean;
  canAccessPipeline: (pipelineKey: DashboardPipelineKey) => boolean;
  refreshAccess: () => Promise<void>;
  listManagedUsers: () => Promise<{ data?: ManagedUserAccess[]; error?: string }>;
  saveUserAccess: (
    userId: string,
    roleId: string,
    pageKeys: DashboardPageKey[],
    pipelineKey: UserPipelineAccessKey,
  ) => Promise<{ error?: string }>;
  createUserAccess: (
    email: string,
    password: string,
    roleId: string,
    pageKeys: DashboardPageKey[],
    pipelineKey: UserPipelineAccessKey,
  ) => Promise<{ error?: string }>;
  deleteUserAccess: (targetUserId: string) => Promise<{ error?: string }>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Falha ao carregar acesso.";
}

function isAccessSetupError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (message.includes("does not exist")) return true;
  if (message.includes("could not find the table")) return true;
  if (message.includes("schema cache")) return true;

  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code: unknown }).code);
    return code === "42P01" || code === "PGRST205" || code === "PGRST200";
  }

  return false;
}

function isPipelineMigrationError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("pipeline_key") || message.includes("dashboard_pipelines");
}

function defaultPipelines(): DashboardPipeline[] {
  return [
    ...DASHBOARD_PIPELINES.map((pipeline, index) => ({
      key: pipeline.key,
      label: pipeline.label,
      bitrix_category_id: pipeline.bitrixCategoryId,
      sort_order: index + 1,
    })),
    {
      key: "ambas",
      label: "Ambas as esteiras",
      bitrix_category_id: 0,
      sort_order: 0,
    },
  ];
}

async function detectPipelineMigrationPending(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<boolean> {
  const tableProbe = await supabase.from("dashboard_pipelines").select("key").limit(1);
  if (!tableProbe.error) return false;

  const columnProbe = await supabase.from("user_profiles").select("pipeline_key").limit(1);
  if (!columnProbe.error) return false;

  return (
    isPipelineMigrationError(tableProbe.error) || isPipelineMigrationError(columnProbe.error)
  );
}

function parseAdminEmails(): Set<string> {
  const raw = import.meta.env.VITE_ADMIN_EMAILS?.trim() ?? "";
  return new Set(
    raw
      .split(",")
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

const ADMIN_EMAILS = parseAdminEmails();

function createFallbackAccess(userId: string, email?: string | null): {
  profile: UserProfile;
  pageKeys: DashboardPageKey[];
  pipelineKey: UserPipelineAccessKey;
} {
  const isAdmin = Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));

  return {
    profile: {
      id: userId,
      email: email ?? "",
      full_name: null,
      role_id: "",
      pipeline_key: DEFAULT_PIPELINE_KEY,
      app_roles: isAdmin
        ? { slug: "administrador", name: "Administrador" }
        : { slug: "lider", name: "Líder" },
    },
    pageKeys: DASHBOARD_PAGES.map((page) => page.key),
    pipelineKey: DEFAULT_PIPELINE_KEY,
  };
}

async function fetchCatalog(supabase: ReturnType<typeof getSupabaseClient>) {
  const [rolesResult, pagesResult, pipelinesResult] = await Promise.all([
    supabase.from("app_roles").select("id, slug, name, sort_order").order("sort_order"),
    supabase.from("dashboard_pages").select("key, label, sort_order").order("sort_order"),
    supabase
      .from("dashboard_pipelines")
      .select("key, label, bitrix_category_id, sort_order")
      .order("sort_order"),
  ]);

  if (rolesResult.error) throw rolesResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    roles: (rolesResult.data ?? []) as AppRole[],
    pages: (pagesResult.data ?? []) as DashboardPage[],
    pipelines: pipelinesResult.error
      ? defaultPipelines()
      : ((pipelinesResult.data ?? []) as DashboardPipeline[]),
  };
}

async function fetchUserProfiles(supabase: ReturnType<typeof getSupabaseClient>) {
  const withPipeline = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role_id, pipeline_key, app_roles ( slug, name )")
    .order("email");

  if (!withPipeline.error) {
    return withPipeline;
  }

  if (!isPipelineMigrationError(withPipeline.error)) {
    return withPipeline;
  }

  return supabase
    .from("user_profiles")
    .select("id, email, full_name, role_id, app_roles ( slug, name )")
    .order("email");
}

async function fetchMyAccess(userId: string, supabase: ReturnType<typeof getSupabaseClient>) {
  const profileQuery = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role_id, pipeline_key, app_roles ( slug, name )")
    .eq("id", userId)
    .maybeSingle();

  const profileResult =
    profileQuery.error && isPipelineMigrationError(profileQuery.error)
      ? await supabase
          .from("user_profiles")
          .select("id, email, full_name, role_id, app_roles ( slug, name )")
          .eq("id", userId)
          .maybeSingle()
      : profileQuery;

  const pagesResult = await supabase.from("user_page_access").select("page_key").eq("user_id", userId);

  if (profileResult.error) throw profileResult.error;
  if (pagesResult.error) throw pagesResult.error;

  const profile = (profileResult.data as UserProfile | null) ?? null;
  if (profile?.app_roles) {
    profile.app_roles = normalizeRoleRelation(profile.app_roles);
  }

  return {
    profile,
    pageKeys: (pagesResult.data ?? []).map((row) => row.page_key as DashboardPageKey),
    pipelineKey: normalizeUserPipelineAccess(profile?.pipeline_key),
  };
}

export function AccessProvider({
  userId,
  userEmail,
  accessToken,
  children,
}: {
  userId: string;
  userEmail?: string | null;
  accessToken?: string | null;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [ready, setReady] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [pipelineMigrationPending, setPipelineMigrationPending] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allowedPages, setAllowedPages] = useState<DashboardPageKey[]>([]);
  const [allowedPipeline, setAllowedPipeline] = useState<UserPipelineAccessKey>(DEFAULT_PIPELINE_KEY);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [pages, setPages] = useState<DashboardPage[]>(DASHBOARD_PAGES as unknown as DashboardPage[]);
  const [pipelines, setPipelines] = useState<DashboardPipeline[]>(defaultPipelines());

  const refreshAccess = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setReady(true);
      setSetupRequired(true);
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();

    try {
      const catalog = await fetchCatalog(supabase);
      setRoles(catalog.roles);
      setPages(catalog.pages);
      setPipelines(catalog.pipelines);

      setPipelineMigrationPending(await detectPipelineMigrationPending(supabase));

      const mine = await fetchMyAccess(userId, supabase);
      setProfile(mine.profile);
      setAllowedPages(mine.pageKeys);
      setAllowedPipeline(mine.pipelineKey);
      setSetupRequired(false);
      setReady(true);
    } catch (error) {
      if (isAccessSetupError(error)) {
        const fallback = createFallbackAccess(userId, userEmail);
        setProfile(fallback.profile);
        setAllowedPages(fallback.pageKeys);
        setAllowedPipeline(fallback.pipelineKey);
        setSetupRequired(false);
        setReady(true);
        return;
      }

      setProfile(null);
      setAllowedPages([]);
      setSetupRequired(false);
      setReady(true);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const roleSlug = normalizeRoleRelation(profile?.app_roles ?? null)?.slug ?? null;
  const isAdministrator = isAdministratorRole(roleSlug);
  const canSwitchPipeline = canUserSwitchPipeline(roleSlug, allowedPipeline);

  const canAccessPage = useCallback(
    (pageKey: DashboardPageKey) => allowedPages.includes(pageKey),
    [allowedPages],
  );

  const canAccessPipeline = useCallback(
    (pipelineKey: DashboardPipelineKey) => {
      if (canSwitchPipeline) return true;
      return allowedPipeline === pipelineKey;
    },
    [allowedPipeline, canSwitchPipeline],
  );

  const canAccessTeam = useCallback(
    (teamId: string) => {
      if (teamId === "overview") return canAccessPage("overview");
      const pageKey = teamIdToPageKey(teamId);
      return pageKey ? canAccessPage(pageKey) : false;
    },
    [canAccessPage],
  );

  const listManagedUsers = useCallback(async () => {
    if (!isAdministrator) {
      return { error: "Apenas administradores podem gerenciar acessos." };
    }

    const supabase = getSupabaseClient();
    const { data: profiles, error: profilesError } = await fetchUserProfiles(supabase);

    if (profilesError) {
      return { error: profilesError.message };
    }

    const { data: accessRows, error: accessError } = await supabase
      .from("user_page_access")
      .select("user_id, page_key");

    if (accessError) {
      return { error: accessError.message };
    }

    const pagesByUser = new Map<string, DashboardPageKey[]>();
    for (const row of accessRows ?? []) {
      const current = pagesByUser.get(row.user_id) ?? [];
      current.push(row.page_key as DashboardPageKey);
      pagesByUser.set(row.user_id, current);
    }

    const users = (profiles ?? []).map((item) => {
      const profile = item as UserProfile;
      if (profile.app_roles) {
        profile.app_roles = normalizeRoleRelation(profile.app_roles);
      }
      return {
        ...profile,
        page_keys: pagesByUser.get(item.id) ?? [],
        pipeline_key: normalizeUserPipelineAccess(profile.pipeline_key),
      };
    });

    return { data: users };
  }, [isAdministrator]);

  const saveUserAccess = useCallback(
    async (
      targetUserId: string,
      roleId: string,
      pageKeys: DashboardPageKey[],
      pipelineKey: UserPipelineAccessKey,
    ) => {
      if (!isAdministrator) {
        return { error: "Apenas administradores podem alterar acessos." };
      }

      if (pageKeys.length === 0) {
        return { error: "Selecione ao menos uma página para o usuário." };
      }

      const supabase = getSupabaseClient();

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ role_id: roleId, pipeline_key: pipelineKey })
        .eq("id", targetUserId);

      let profileUpdateError = profileError;
      if (profileError && isPipelineMigrationError(profileError)) {
        const { error: fallbackError } = await supabase
          .from("user_profiles")
          .update({ role_id: roleId })
          .eq("id", targetUserId);
        profileUpdateError = fallbackError;
      }

      if (profileUpdateError) {
        return { error: profileUpdateError.message };
      }

      const { error: deleteError } = await supabase
        .from("user_page_access")
        .delete()
        .eq("user_id", targetUserId);

      if (deleteError) {
        return { error: deleteError.message };
      }

      const { error: insertError } = await supabase.from("user_page_access").insert(
        pageKeys.map((pageKey) => ({
          user_id: targetUserId,
          page_key: pageKey,
        })),
      );

      if (insertError) {
        return { error: insertError.message };
      }

      if (targetUserId === userId) {
        await refreshAccess();
      }

      return {};
    },
    [isAdministrator, refreshAccess, userId],
  );

  const createUserAccess = useCallback(
    async (
      email: string,
      password: string,
      roleId: string,
      pageKeys: DashboardPageKey[],
      pipelineKey: UserPipelineAccessKey,
    ) => {
      if (!isAdministrator) {
        return { error: "Apenas administradores podem criar acessos." };
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { error: "Informe o e-mail do usuário." };
      }

      if (password.length < 6) {
        return { error: "A senha deve ter no mínimo 6 caracteres." };
      }

      if (!roleId) {
        return { error: "Selecione uma visão." };
      }

      if (pageKeys.length === 0) {
        return { error: "Selecione ao menos uma página." };
      }

      if (!accessToken) {
        return { error: "Sessão expirada. Faça login novamente." };
      }

      const result = await createUserAccessFn({
        data: {
          accessToken,
          email: normalizedEmail,
          password,
          roleId,
          pageKeys,
          pipelineKey,
        },
      });

      if (result.error) {
        return { error: result.error };
      }

      await refreshAccess();
      return {};
    },
    [accessToken, isAdministrator, refreshAccess],
  );

  const deleteUserAccess = useCallback(
    async (targetUserId: string) => {
      if (!isAdministrator) {
        return { error: "Apenas administradores podem excluir acessos." };
      }

      if (targetUserId === userId) {
        return { error: "Você não pode excluir o seu próprio acesso." };
      }

      if (!accessToken) {
        return { error: "Sessão expirada. Faça login novamente." };
      }

      const result = await deleteUserAccessFn({
        data: {
          accessToken,
          targetUserId,
        },
      });

      if (result.error) {
        return { error: result.error };
      }

      return {};
    },
    [accessToken, isAdministrator, userId],
  );

  const value = useMemo<AccessContextValue>(
    () => ({
      loading,
      ready,
      setupRequired,
      pipelineMigrationPending,
      profile,
      roleSlug,
      isAdministrator,
      allowedPages,
      allowedPipeline,
      canSwitchPipeline,
      pipelines,
      pages,
      roles,
      canAccessPage,
      canAccessTeam,
      canAccessPipeline,
      refreshAccess,
      listManagedUsers,
      saveUserAccess,
      createUserAccess,
      deleteUserAccess,
    }),
    [
      loading,
      ready,
      setupRequired,
      pipelineMigrationPending,
      profile,
      roleSlug,
      isAdministrator,
      allowedPages,
      allowedPipeline,
      canSwitchPipeline,
      pipelines,
      pages,
      roles,
      canAccessPage,
      canAccessTeam,
      canAccessPipeline,
      refreshAccess,
      listManagedUsers,
      saveUserAccess,
      createUserAccess,
      deleteUserAccess,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error("useAccess deve ser usado dentro de AccessProvider.");
  }
  return context;
}
