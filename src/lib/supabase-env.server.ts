export function getSupabaseUrl(): string {
  return (
    process.env.VITE_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    ""
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ""
  );
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

export function parseServerAdminEmails(): Set<string> {
  const raw = process.env.VITE_ADMIN_EMAILS?.trim() ?? "";
  const defaults = ["rafaelarcanjods@gmail.com", "rafaelarcanjods05@gmail.com"];
  const fromEnv = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...defaults, ...fromEnv]);
}
