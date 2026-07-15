import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260715103000_access_control.sql",
);

const sql = readFileSync(migrationPath, "utf8");

console.log("Aplique este SQL no Supabase → SQL Editor:\n");
console.log(`Arquivo: ${migrationPath}\n`);
console.log("---");
console.log(sql);
console.log("---\n");
console.log(
  "Depois confirme com: node scripts/verify-access-setup.mjs <seu-email>",
);
