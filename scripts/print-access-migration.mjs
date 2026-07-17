import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const migrations = [
  "20260715103000_access_control.sql",
  "20260715120000_dashboard_pipelines.sql",
  "20260715130000_pipeline_access_ambas.sql",
  "20260717103000_economico_dashboard_pages.sql",
];

console.log("Aplique estes SQL no Supabase → SQL Editor:\n");

for (const fileName of migrations) {
  const migrationPath = join(root, "supabase", "migrations", fileName);
  const sql = readFileSync(migrationPath, "utf8");

  console.log(`Arquivo: ${migrationPath}\n`);
  console.log("---");
  console.log(sql);
  console.log("---\n");
}

console.log("Depois confirme com: node scripts/verify-access-setup.mjs <seu-email>");
