import { readFileSync } from "fs";
import { pathToFileURL } from "url";

// Load .env.local like Vite does
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

const started = Date.now();
const mod = await import(pathToFileURL("./src/lib/fetch-dashboard.ts").href);
const data = await mod.getDashboardData();
console.log("source:", data.source);
console.log("error:", data.error || "none");
console.log("dealCount:", data.dealCount ?? "n/a");
console.log(
  "teams totals:",
  data.teams.map((t) => ({
    id: t.id,
    members: t.members.length,
    total: t.members.reduce((a, m) => {
      const vals = Object.values(m.matrix).flatMap((row) => Object.values(row ?? {}));
      return a + vals.reduce((s, n) => s + n, 0);
    }, 0),
  })),
);
console.log("elapsed:", Date.now() - started, "ms");
