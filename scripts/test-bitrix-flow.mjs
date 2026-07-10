import { readFileSync } from "fs";
import { pathToFileURL } from "url";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const key = m[1].trim();
  let val = m[2].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const bitrix = await import(pathToFileURL("./src/lib/bitrix.ts").href);
const started = Date.now();

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    const count = Array.isArray(result) ? result.length : 0;
    console.log(`${label}: ok (${count}) in ${Date.now() - t0}ms`);
    return result;
  } catch (e) {
    console.log(`${label}: FAIL ${e.message} in ${Date.now() - t0}ms`);
    throw e;
  }
}

console.log("webhook:", bitrix.hasBitrixWebhook());
const departments = await timed("departments", () => bitrix.fetchDepartments());
const users = await timed("users", () => bitrix.fetchUsers());
const stages = await timed("stages", () => bitrix.fetchDealStages(16));

const focusNames = ["focus elite", "focus líder", "focus lider", "focus total"];
const focusDepts = departments.filter((d) =>
  focusNames.includes(String(d.NAME).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()),
);
console.log(
  "focus departments:",
  focusDepts.map((d) => `${d.ID}:${d.NAME}`),
);

const focusUsers = users.filter((u) => {
  const deps = Array.isArray(u.UF_DEPARTMENT) ? u.UF_DEPARTMENT : [u.UF_DEPARTMENT];
  return deps.some((id) => focusDepts.some((d) => String(d.ID) === String(id)));
});
console.log("focus users:", focusUsers.length);

const userIds = focusUsers.map((u) => String(u.ID));
const deals = await timed("deals", () => bitrix.fetchDealsInYear(2026, 16, userIds));
console.log("total elapsed:", Date.now() - started, "ms");
