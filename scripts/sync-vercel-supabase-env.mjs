import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_ADMIN_EMAILS",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const ENVIRONMENTS = ["production", "preview", "development"];

function parseEnvFile(path) {
  let content = "";
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }

  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function envExists(name, environment) {
  try {
    const output = execSync(`npx vercel env ls ${environment}`, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.includes(name);
  } catch {
    return false;
  }
}

function addEnv(name, value, environment) {
  execSync(`npx vercel env add ${name} ${environment} --yes`, {
    cwd: process.cwd(),
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
}

const envPath = resolve(process.cwd(), ".env.local");
const values = parseEnvFile(envPath);
const missingLocal = ENV_KEYS.filter((key) => !values[key]?.trim());

if (missingLocal.length > 0) {
  console.error(`Variáveis ausentes em .env.local: ${missingLocal.join(", ")}`);
  process.exit(1);
}

for (const key of ENV_KEYS) {
  const value = values[key].trim();
  for (const environment of ENVIRONMENTS) {
    if (envExists(key, environment)) {
      console.log(`OK  ${key} (${environment})`);
      continue;
    }

    console.log(`ADD ${key} (${environment})`);
    addEnv(key, value, environment);
  }
}

console.log("Variáveis do Supabase sincronizadas na Vercel.");
