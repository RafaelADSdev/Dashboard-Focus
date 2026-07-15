import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdministrator, createSupabaseAdminClient } from "@/lib/supabase-admin.server";

export type DeleteUserAccessInput = {
  accessToken: string;
  targetUserId: string;
};

export type DeleteUserAccessResult = { error?: string };

async function removeAccessRecords(
  adminClient: SupabaseClient,
  targetUserId: string,
): Promise<DeleteUserAccessResult> {
  const { error: pageError } = await adminClient
    .from("user_page_access")
    .delete()
    .eq("user_id", targetUserId);

  if (pageError) {
    return { error: pageError.message };
  }

  const { error: profileError } = await adminClient
    .from("user_profiles")
    .delete()
    .eq("id", targetUserId);

  if (profileError) {
    return { error: profileError.message };
  }

  return {};
}

export async function deleteUserAccessImpl(
  input: DeleteUserAccessInput,
): Promise<DeleteUserAccessResult> {
  const targetUserId = input.targetUserId.trim();

  if (!targetUserId) {
    return { error: "Usuário inválido." };
  }

  const adminCheck = await assertAdministrator(input.accessToken);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  if (adminCheck.userId === targetUserId) {
    return { error: "Você não pode excluir o seu próprio acesso." };
  }

  const adminResult = createSupabaseAdminClient();
  if ("error" in adminResult) {
    return { error: adminResult.error };
  }

  const adminClient = adminResult.client;
  const accessResult = await removeAccessRecords(adminClient, targetUserId);
  if (accessResult.error) {
    return accessResult;
  }

  const { error: authError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (authError) {
    const message = authError.message.toLowerCase();
    if (!message.includes("not found") && !message.includes("user not found")) {
      return { error: authError.message };
    }
  }

  return {};
}
