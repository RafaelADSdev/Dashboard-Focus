import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? "https://vhtztzilrrlbflicmeft.supabase.co";
const key =
  process.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_cSuE-ncPutBEAO-EmV0mFw_fYvuNt9i";
const email = process.argv[2];
const password = process.argv[3] ?? "123456";

if (!email) {
  console.error("Uso: node scripts/verify-access-setup.mjs <email> [senha]");
  process.exit(1);
}

const supabase = createClient(url, key);
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError) {
  console.error("ERRO login:", authError.message);
  process.exit(1);
}

const userId = authData.user?.id;
if (!userId) {
  console.error("ERRO: usuário sem id.");
  process.exit(1);
}

const checks = await Promise.all([
  supabase.from("app_roles").select("slug").limit(5),
  supabase.from("dashboard_pages").select("key").limit(5),
  supabase
    .from("user_profiles")
    .select("email, app_roles(slug, name)")
    .eq("id", userId)
    .maybeSingle(),
  supabase.from("user_page_access").select("page_key").eq("user_id", userId),
]);

const labels = ["app_roles", "dashboard_pages", "user_profiles", "user_page_access"];
checks.forEach((result, index) => {
  if (result.error) {
    console.log(`✗ ${labels[index]}: ${result.error.message}`);
    return;
  }
  console.log(`✓ ${labels[index]}:`, JSON.stringify(result.data));
});

await supabase.auth.signOut();
