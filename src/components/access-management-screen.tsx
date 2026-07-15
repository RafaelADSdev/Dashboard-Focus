import { ArrowLeft, Loader2, Save, Shield, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardPageKey, ManagedUserAccess } from "@/lib/access-control";
import { DASHBOARD_PAGES, normalizeRoleRelation } from "@/lib/access-control";
import { useAccess } from "@/lib/access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DraftAccess = {
  roleId: string;
  pageKeys: Set<DashboardPageKey>;
};

type AccessManagementScreenProps = {
  onBack: () => void;
};

const defaultNewPageKeys = () => new Set<DashboardPageKey>(["overview"]);

function PageCheckboxGrid({
  pages,
  selected,
  onToggle,
  idPrefix,
}: {
  pages: { key: DashboardPageKey; label: string }[];
  selected: Set<DashboardPageKey>;
  onToggle: (pageKey: DashboardPageKey, checked: boolean) => void;
  idPrefix: string;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {pages.map((page) => {
        const checked = selected.has(page.key);
        const inputId = `${idPrefix}-${page.key}`;
        return (
          <label
            key={page.key}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              checked
                ? "border-violet-300 bg-violet-50 text-violet-900"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            <input
              id={inputId}
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={checked}
              onChange={(event) => onToggle(page.key, event.target.checked)}
            />
            <span>{page.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function AccessManagementScreen({ onBack }: AccessManagementScreenProps) {
  const { pages, roles, profile, listManagedUsers, saveUserAccess, createUserAccess, deleteUserAccess } =
    useAccess();
  const [users, setUsers] = useState<ManagedUserAccess[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftAccess>>({});
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newPageKeys, setNewPageKeys] = useState<Set<DashboardPageKey>>(defaultNewPageKeys);

  const catalogPages = pages.length > 0 ? pages : DASHBOARD_PAGES;
  const defaultRoleId = roles.find((role) => role.slug === "lider")?.id ?? roles[0]?.id ?? "";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listManagedUsers();
    if (result.error) {
      setError(result.error);
      setUsers([]);
      setDrafts({});
      setLoading(false);
      return;
    }

    const nextUsers = result.data ?? [];
    setUsers(nextUsers);
    setDrafts(
      Object.fromEntries(
        nextUsers.map((user) => [
          user.id,
          {
            roleId: user.role_id,
            pageKeys: new Set(user.page_keys),
          },
        ]),
      ),
    );
    setLoading(false);
  }, [listManagedUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!newRoleId && defaultRoleId) {
      setNewRoleId(defaultRoleId);
    }
  }, [defaultRoleId, newRoleId]);

  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  function updateRole(userId: string, roleId: string) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        roleId,
      },
    }));
    setSuccess(null);
  }

  function togglePage(userId: string, pageKey: DashboardPageKey, checked: boolean) {
    setDrafts((current) => {
      const draft = current[userId];
      if (!draft) return current;
      const pageKeys = new Set(draft.pageKeys);
      if (checked) pageKeys.add(pageKey);
      else pageKeys.delete(pageKey);
      return {
        ...current,
        [userId]: {
          ...draft,
          pageKeys,
        },
      };
    });
    setSuccess(null);
  }

  function toggleNewPage(pageKey: DashboardPageKey, checked: boolean) {
    setNewPageKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(pageKey);
      else next.delete(pageKey);
      return next;
    });
    setSuccess(null);
  }

  async function handleSave(user: ManagedUserAccess) {
    const draft = drafts[user.id];
    if (!draft) return;

    setSavingUserId(user.id);
    setError(null);
    setSuccess(null);

    const result = await saveUserAccess(user.id, draft.roleId, [...draft.pageKeys]);
    if (result.error) {
      setError(result.error);
      setSavingUserId(null);
      return;
    }

    setSuccess(`Acesso de ${user.email} atualizado.`);
    await loadUsers();
    setSavingUserId(null);
  }

  async function handleCreateAccess() {
    if (!newRoleId) {
      setError("Selecione uma visão para o novo usuário.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    const result = await createUserAccess(
      newEmail,
      newPassword,
      newRoleId,
      [...newPageKeys],
    );

    if (result.error) {
      setError(result.error);
      setCreating(false);
      return;
    }

    setSuccess(`Acesso criado para ${newEmail.trim().toLowerCase()}.`);
    setNewEmail("");
    setNewPassword("");
    setNewPageKeys(defaultNewPageKeys());
    setNewRoleId(defaultRoleId);
    await loadUsers();
    setCreating(false);
  }

  async function handleDelete(user: ManagedUserAccess) {
    const confirmed = window.confirm(
      `Excluir o acesso de ${user.email}?\n\nA conta será removida do Supabase Auth e não poderá mais entrar no dashboard.`,
    );

    if (!confirmed) return;

    setDeletingUserId(user.id);
    setError(null);
    setSuccess(null);

    const result = await deleteUserAccess(user.id);
    if (result.error) {
      setError(result.error);
      setDeletingUserId(null);
      return;
    }

    setSuccess(`Acesso de ${user.email} excluído.`);
    await loadUsers();
    setDeletingUserId(null);
  }

  return (
    <div className="access-screen-shell">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col px-4 py-4 pb-10 md:px-6">
        <header className="dash-navbar mb-4 shrink-0 rounded-2xl px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
                Administração
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
                <Shield className="h-6 w-6" aria-hidden />
                Gestão de acesso
              </h1>
              <p className="mt-1 text-sm text-white/75">
                Crie, edite ou exclua acessos. Ajuste a visão e as páginas de cada usuário.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="dash-btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar ao dashboard
            </button>
          </div>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        <section className="dash-panel mb-4 rounded-2xl p-4 md:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <UserPlus className="h-5 w-5 text-violet-700" aria-hidden />
            Novo acesso
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cria a conta no Supabase Auth e define visão e páginas. Senha mínima: 6 caracteres.
          </p>

          {roles.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Execute as migrations do Supabase para habilitar a criação de acessos.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="new-access-email" className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    E-mail
                  </label>
                  <input
                    id="new-access-email"
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="usuario@empresa.com"
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="new-access-password" className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Senha temporária
                  </label>
                  <input
                    id="new-access-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 md:max-w-xs">
                <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Visão
                </label>
                <Select value={newRoleId} onValueChange={setNewRoleId}>
                  <SelectTrigger className="h-10 border-slate-200 bg-white text-slate-900">
                    <span>{roleById.get(newRoleId)?.name ?? "Selecionar visão"}</span>
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900">
                    {roles.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Páginas do dashboard
                </p>
                <PageCheckboxGrid
                  pages={catalogPages}
                  selected={newPageKeys}
                  onToggle={toggleNewPage}
                  idPrefix="new-access"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    creating ||
                    !newEmail.trim() ||
                    newPassword.length < 6 ||
                    !newRoleId ||
                    newPageKeys.size === 0
                  }
                  onClick={() => void handleCreateAccess()}
                  className="dash-btn-active inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="h-4 w-4" aria-hidden />
                  )}
                  Criar acesso
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="dash-panel rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Usuários cadastrados</h2>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando usuários…
            </div>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Nenhum usuário cadastrado ainda. Use o formulário acima para criar o primeiro acesso.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {users.map((user) => {
                const draft = drafts[user.id];
                const role = draft ? roleById.get(draft.roleId) : null;
                const currentRole = normalizeRoleRelation(user.app_roles);
                const isSaving = savingUserId === user.id;
                const isDeleting = deletingUserId === user.id;
                const isCurrentUser = profile?.id === user.id;

                return (
                  <article
                    key={user.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          {user.full_name?.trim() || user.email}
                        </h3>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        {currentRole ? (
                          <p className="mt-1 text-xs text-slate-400">
                            Visão atual: <span className="font-medium">{currentRole.name}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="flex min-w-[220px] flex-col gap-2">
                        <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Visão
                        </label>
                        <Select
                          value={draft?.roleId ?? user.role_id}
                          onValueChange={(value) => updateRole(user.id, value)}
                        >
                          <SelectTrigger className="h-10 border-slate-200 bg-white text-slate-900">
                            <span>{role?.name ?? "Selecionar visão"}</span>
                          </SelectTrigger>
                          <SelectContent className="border-slate-200 bg-white text-slate-900">
                            {roles.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Páginas do dashboard
                      </p>
                      <PageCheckboxGrid
                        pages={catalogPages}
                        selected={draft?.pageKeys ?? new Set()}
                        onToggle={(pageKey, checked) => togglePage(user.id, pageKey, checked)}
                        idPrefix={`user-${user.id}`}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={isDeleting || isCurrentUser}
                        onClick={() => void handleDelete(user)}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:opacity-60"
                        title={isCurrentUser ? "Você não pode excluir o seu próprio acesso" : undefined}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                        Excluir acesso
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || !draft || draft.pageKeys.size === 0}
                        onClick={() => void handleSave(user)}
                        className="dash-btn-active inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Save className="h-4 w-4" aria-hidden />
                        )}
                        Salvar acesso
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function AccessPendingScreen({ email }: { email?: string | null }) {
  return (
    <main className="login-shell flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
        <h1 className="text-xl font-semibold">Acesso pendente</h1>
        <p className="mt-2 text-sm text-white/75">
          A conta <strong>{email ?? "sem e-mail"}</strong> ainda não possui permissões
          configuradas. Peça a um administrador para liberar seu acesso.
        </p>
      </div>
    </main>
  );
}

export function AccessSetupRequiredScreen() {
  return (
    <main className="login-shell flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
        <h1 className="text-xl font-semibold">Configuração de acesso necessária</h1>
        <p className="mt-2 text-sm text-white/75">
          Execute as migrations em{" "}
          <code className="rounded bg-black/30 px-1 py-0.5">supabase/migrations/</code> no SQL
          Editor do Supabase para ativar papéis e permissões.
        </p>
      </div>
    </main>
  );
}
