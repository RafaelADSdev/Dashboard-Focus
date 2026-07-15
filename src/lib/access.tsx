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
  isAdministratorRole,
  normalizeRoleRelation,
  type AppRole,
  type DashboardPage,
  type DashboardPageKey,
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
  profile: UserProfile | null;
  roleSlug: string | null;
  isAdministrator: boolean;
  allowedPages: DashboardPageKey[];
  pages: DashboardPage[];
  roles: AppRole[];
  canAccessPage: (pageKey: DashboardPageKey) => boolean;
  canAccessTeam: (teamId: string) => boolean;
  refreshAccess: () => Promise<void>;
  listManagedUsers: () => Promise<{ data?: ManagedUserAccess[]; error?: string }>;
  saveUserAccess: (
    userId: string,
    roleId: string,
    pageKeys: DashboardPageKey[],
  ) => Promise<{ error?: string }>;
  createUserAccess: (
    email: string,
    password: string,
    roleId: string,
    pageKeys: DashboardPageKey[],
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

function parseAdminEmails(): Set<string> {
  const raw = import.meta.env.VITE_ADMIN_EMAILS?.trim() ?? "";
  const defaults = ["rafaelarcanjods@gmail.com", "rafaelarcanjods05@gmail.com"];
  const fromEnv = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...defaults, ...fromEnv]);
}

const ADMIN_EMAILS = parseAdminEmails();

function createFallbackAccess(userId: string, email?: string | null): {
  profile: UserProfile;
  pageKeys: DashboardPageKey[];
} {
  const isAdmin = Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));

  return {
    profile: {
      id: userId,
      email: email ?? "",
      full_name: null,
      role_id: "",
      app_roles: isAdmin
        ? { slug: "administrador", name: "Administrador" }
        : { slug: "lider", name: "Líder" },
    },
    pageKeys: DASHBOARD_PAGES.map((page) => page.key),
  };
}

async function fetchCatalog(supabase: ReturnType<typeof getSupabaseClient>) {
  const [rolesResult, pagesResult] = await Promise.all([
    supabase.from("app_roles").select("id, slug, name, sort_order").order("sort_order"),
    supabase.from("dashboard_pages").select("key, label, sort_order").order("sort_order"),
  ]);

  if (rolesResult.error) throw rolesResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    roles: (rolesResult.data ?? []) as AppRole[],
    pages: (pagesResult.data ?? []) as DashboardPage[],
  };
}

async function fetchMyAccess(userId: string, supabase: ReturnType<typeof getSupabaseClient>) {
  const [profileResult, pagesResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, email, full_name, role_id, app_roles ( slug, name )")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_page_access").select("page_key").eq("user_id", userId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (pagesResult.error) throw pagesResult.error;

  const profile = (profileResult.data as UserProfile | null) ?? null;
  if (profile?.app_roles) {
    profile.app_roles = normalizeRoleRelation(profile.app_roles);
  }

  return {
    profile,
    pageKeys: (pagesResult.data ?? []).map((row) => row.page_key as DashboardPageKey),
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allowedPages, setAllowedPages] = useState<DashboardPageKey[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [pages, setPages] = useState<DashboardPage[]>(DASHBOARD_PAGES as unknown as DashboardPage[]);

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

      const mine = await fetchMyAccess(userId, supabase);
      setProfile(mine.profile);
      setAllowedPages(mine.pageKeys);
      setSetupRequired(false);
      setReady(true);
    } catch (error) {
      if (isAccessSetupError(error)) {
        const fallback = createFallbackAccess(userId, userEmail);
        setProfile(fallback.profile);
        setAllowedPages(fallback.pageKeys);
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

  const canAccessPage = useCallback(
    (pageKey: DashboardPageKey) => allowedPages.includes(pageKey),
    [allowedPages],
  );

  const canAccessTeam = useCallback(
    (teamId: string) => {
      if (teamId === "overview") return canAccessPage("overview");
      const pageKey = `team:${teamId}` as DashboardPageKey;
      return canAccessPage(pageKey);
    },
    [canAccessPage],
  );

  const listManagedUsers = useCallback(async () => {
    if (!isAdministrator) {
      return { error: "Apenas administradores podem gerenciar acessos." };
    }

    const supabase = getSupabaseClient();
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, role_id, app_roles ( slug, name )")
      .order("email");

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
      };
    });

    return { data: users };
  }, [isAdministrator]);

  const saveUserAccess = useCallback(
    async (targetUserId: string, roleId: string, pageKeys: DashboardPageKey[]) => {
      if (!isAdministrator) {
        return { error: "Apenas administradores podem alterar acessos." };
      }

      if (pageKeys.length === 0) {
        return { error: "Selecione ao menos uma página para o usuário." };
      }

      const supabase = getSupabaseClient();

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ role_id: roleId })
        .eq("id", targetUserId);

      if (profileError) {
        return { error: profileError.message };
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
      profile,
      roleSlug,
      isAdministrator,
      allowedPages,
      pages,
      roles,
      canAccessPage,
      canAccessTeam,
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
      profile,
      roleSlug,
      isAdministrator,
      allowedPages,
      pages,
      roles,
      canAccessPage,
      canAccessTeam,
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
