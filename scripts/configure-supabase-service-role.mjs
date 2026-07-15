import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const serviceRoleKey = process.argv[2]?.trim();

if (!serviceRoleKey) {
  console.error("Uso: node scripts/configure-supabase-service-role.mjs <SUPABASE_SERVICE_ROLE_KEY>");
  console.error("");
  console.error("Encontre a chave em:");
  console.error("Supabase → Settings → API → service_role (secret)");
  process.exit(1);
}

const envPath = resolve(process.cwd(), ".env.local");
let content = "";

try {
  content = readFileSync(envPath, "utf8");
} catch {
  content = "";
}

const line = `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`;
const pattern = /^SUPABASE_SERVICE_ROLE_KEY=.*$/m;

if (pattern.test(content)) {
  content = content.replace(pattern, line);
} else {
  content = content.trimEnd();
  content += `${content ? "\n" : ""}${line}\n`;
}

writeFileSync(envPath, content, "utf8");

const url =
  process.env.VITE_SUPABASE_URL?.trim() ??
  content.match(/^VITE_SUPABASE_URL=(?:"([^"]+)"|([^\r\n]+))/m)?.[1]?.trim() ??
  content.match(/^VITE_SUPABASE_URL=(?:"([^"]+)"|([^\r\n]+))/m)?.[2]?.trim() ??
  "";

if (!url) {
  console.log("SUPABASE_SERVICE_ROLE_KEY gravada em .env.local");
  console.log("Defina também VITE_SUPABASE_URL antes de testar.");
  process.exit(0);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });

if (error) {
  console.error("Chave gravada, mas a validação falhou:", error.message);
  process.exit(1);
}

console.log("SUPABASE_SERVICE_ROLE_KEY configurada e validada em .env.local");
console.log("Reinicie o npm run dev e adicione a mesma variável na Vercel.");
