import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL ?? "https://vhtztzilrrlbflicmeft.supabase.co";
const key =
  process.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_cSuE-ncPutBEAO-EmV0mFw_fYvuNt9i";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Uso: node scripts/test-supabase-login.mjs <email> <senha>");
  process.exit(1);
}

const supabase = createClient(url, key);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error("ERRO:", error.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, email: data.user?.email, hasSession: Boolean(data.session) }, null, 2));
