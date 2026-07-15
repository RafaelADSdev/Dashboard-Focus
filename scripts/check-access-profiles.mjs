import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? "https://vhtztzilrrlbflicmeft.supabase.co";
const key =
  process.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_cSuE-ncPutBEAO-EmV0mFw_fYvuNt9i";

const emails = process.argv.slice(2);
if (emails.length === 0) {
  emails.push("rafaelarcanjods@gmail.com", "rafaelarcanjods05@gmail.com");
}

const supabase = createClient(url, key);

const { data: roles, error: rolesError } = await supabase.from("app_roles").select("id, slug, name");
console.log("ROLES:", rolesError?.message ?? roles);

for (const email of emails) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, role_id, app_roles(slug, name)")
    .eq("email", email);

  console.log(`PROFILE ${email}:`, error?.message ?? data);
}
