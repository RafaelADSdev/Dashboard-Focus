import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  parseServerAdminEmails,
} from "@/lib/supabase-env.server";

export async function assertAdministrator(
  accessToken: string,
): Promise<{ userId: string } | { error: string }> {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return { error: "Supabase não configurado no servidor." };
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { error: "Sessão inválida. Faça login novamente." };
  }

  const email = userData.user.email?.trim().toLowerCase() ?? "";
  if (email && parseServerAdminEmails().has(email)) {
    return { userId: userData.user.id };
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc("is_administrator");
  if (!adminError && isAdmin) {
    return { userId: userData.user.id };
  }

  const { data: profile } = await userClient
    .from("user_profiles")
    .select("app_roles ( slug )")
    .eq("id", userData.user.id)
    .maybeSingle();

  const roleSlug =
    profile?.app_roles &&
    typeof profile.app_roles === "object" &&
    "slug" in profile.app_roles
      ? String((profile.app_roles as { slug?: string }).slug ?? "")
      : "";

  if (roleSlug === "administrador") {
    return { userId: userData.user.id };
  }

  return { error: "Apenas administradores podem gerenciar acessos." };
}

export function createSupabaseAdminClient():
  | { client: SupabaseClient }
  | { error: string } {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Adicione em .env.local e na Vercel.",
    };
  }

  return {
    client: createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
