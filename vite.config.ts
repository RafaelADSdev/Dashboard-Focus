import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";

const SERVER_ENV_KEYS = [
  "BITRIX_WEBHOOK_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_ADMIN_EMAILS",
] as const;

function applyServerEnv(env: Record<string, string>) {
  for (const key of SERVER_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      process.env[key] = value;
    }
  }
}

const nitroConfig = {
  env: [...SERVER_ENV_KEYS],
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
};

const lovableConfig = defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: nitroConfig,
});

export default (configEnv: ConfigEnv) => {
  const env = loadEnv(configEnv.mode, process.cwd(), "");
  applyServerEnv(env);

  return lovableConfig(configEnv);
};
