import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const m = env.match(/^BITRIX_WEBHOOK_URL=(.+)$/m);
if (!m) {
  console.log("BITRIX_WEBHOOK_URL not found in .env.local");
  process.exit(1);
}

const base = m[1].trim().replace(/^"|"$/g, "").replace(/\/$/, "");
console.log("host:", new URL(base).host);

async function test(method, params = {}) {
  const url = `${base}/${method}`;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json();
    const count = Array.isArray(json.result)
      ? json.result.length
      : json.result?.items?.length ?? Object.keys(json.result ?? {}).length;
    console.log(method, "->", res.status, json.error || "ok", `items=${count}`, `${Date.now() - started}ms`);
    return json;
  } catch (e) {
    console.log(method, "->", "FAIL", e.message, e.cause?.message || "", `${Date.now() - started}ms`);
  }
}

await test("department.get", { start: 0 });
await test("user.get", { start: 0 });
await test("crm.status.list", { "filter[ENTITY_ID]": "DEAL_STAGE_16" });
