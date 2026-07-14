import { createServerFn } from "@tanstack/react-start";
import { DASHBOARD_YEAR, type DashboardPayload } from "@/lib/dashboard-payload";

export type { DashboardPayload } from "@/lib/dashboard-payload";
export { DASHBOARD_YEAR, createPlaceholderDashboard } from "@/lib/dashboard-payload";

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPayload> => {
    const { getDashboardDataImpl } = await import("@/lib/fetch-dashboard.server");
    return getDashboardDataImpl();
  },
);

/** Usado pelo cron da Vercel para manter o cache aquecido. */
export const warmDashboardCache = createServerFn({ method: "GET" }).handler(async () => {
  const { warmDashboardCacheHandler } = await import("@/lib/fetch-dashboard.server");
  return warmDashboardCacheHandler();
});

export const dashboardQueryOptions = {
  queryKey: ["dashboard", DASHBOARD_YEAR] as const,
  queryFn: () => getDashboardData(),
  staleTime: 15 * 60 * 1_000,
  refetchOnWindowFocus: false as const,
  refetchInterval: (query: { state: { data?: DashboardPayload } }) => {
    const payload = query.state.data;
    return payload?.source === "unavailable" && !payload.error ? 2_000 : false;
  },
};
