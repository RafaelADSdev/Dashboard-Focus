import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";

const nitroConfig = {
  env: ["BITRIX_WEBHOOK_URL"],
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
  if (env.BITRIX_WEBHOOK_URL) {
    process.env.BITRIX_WEBHOOK_URL = env.BITRIX_WEBHOOK_URL;
  }

  return lovableConfig(configEnv);
};
