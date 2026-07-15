import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DashboardPageKey, UserPipelineAccessKey } from "@/lib/access-control";
import { assertAdministrator, createSupabaseAdminClient } from "@/lib/supabase-admin.server";

export type CreateUserAccessInput = {
  accessToken: string;
  email: string;
  password: string;
  roleId: string;
  pageKeys: DashboardPageKey[];
  pipelineKey: UserPipelineAccessKey;
};

export type CreateUserAccessResult = { error?: string };

function mapAdminCreateUserError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Este e-mail já possui conta. O acesso será atualizado.";
  }
  if (normalized.includes("rate limit")) {
    return "Limite de envio de e-mails do Supabase atingido. Tente novamente em alguns minutos.";
  }
  if (normalized.includes("password")) {
    return "A senha deve ter no mínimo 6 caracteres.";
  }
  return message;
}

async function assertAdministratorForCreate(accessToken: string) {
  return assertAdministrator(accessToken);
}

async function findAuthUserIdByEmail(
  adminClient: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match?.id) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return undefined;
}

function isPipelineMigrationErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("pipeline_key") || normalized.includes("dashboard_pipelines");
}

async function saveAccessWithServiceRole(
  adminClient: SupabaseClient,
  userId: string,
  email: string,
  roleId: string,
  pageKeys: DashboardPageKey[],
  pipelineKey: UserPipelineAccessKey,
): Promise<CreateUserAccessResult> {
  const { error: profileError } = await adminClient.from("user_profiles").upsert(
    {
      id: userId,
      email,
      role_id: roleId,
      pipeline_key: pipelineKey,
    },
    { onConflict: "id" },
  );

  let profileUpsertError = profileError;
  if (profileError && isPipelineMigrationErrorMessage(profileError.message)) {
    const { error: fallbackError } = await adminClient.from("user_profiles").upsert(
      {
        id: userId,
        email,
        role_id: roleId,
      },
      { onConflict: "id" },
    );
    profileUpsertError = fallbackError;
  }

  if (profileUpsertError) {
    return { error: profileUpsertError.message };
  }

  const { error: deleteError } = await adminClient
    .from("user_page_access")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: insertError } = await adminClient.from("user_page_access").insert(
    pageKeys.map((pageKey) => ({
      user_id: userId,
      page_key: pageKey,
    })),
  );

  if (insertError) {
    return { error: insertError.message };
  }

  return {};
}

export async function createUserAccessImpl(
  input: CreateUserAccessInput,
): Promise<CreateUserAccessResult> {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedEmail) {
    return { error: "Informe o e-mail do usuário." };
  }

  if (input.password.length < 6) {
    return { error: "A senha deve ter no mínimo 6 caracteres." };
  }

  if (!input.roleId) {
    return { error: "Selecione uma visão." };
  }

  if (input.pageKeys.length === 0) {
    return { error: "Selecione ao menos uma página." };
  }

  const adminCheck = await assertAdministratorForCreate(input.accessToken);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const adminResult = createSupabaseAdminClient();
  if ("error" in adminResult) {
    return { error: adminResult.error };
  }

  const adminClient = adminResult.client;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
  });

  let userId = created.user?.id;

  if (!userId && createError) {
    const message = createError.message.toLowerCase();
    const alreadyExists =
      message.includes("already registered") || message.includes("already been registered");

    if (!alreadyExists) {
      return { error: mapAdminCreateUserError(createError.message) };
    }

    try {
      userId = await findAuthUserIdByEmail(adminClient, normalizedEmail);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha ao localizar usuário.";
      return { error: reason };
    }

    if (!userId) {
      return { error: "Usuário já existe, mas não foi possível localizar a conta no Auth." };
    }

    const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, {
      password: input.password,
    });

    if (passwordError) {
      return { error: mapAdminCreateUserError(passwordError.message) };
    }
  }

  if (!userId) {
    return { error: "Não foi possível criar o usuário." };
  }

  return saveAccessWithServiceRole(
    adminClient,
    userId,
    normalizedEmail,
    input.roleId,
    input.pageKeys,
    input.pipelineKey,
  );
}
