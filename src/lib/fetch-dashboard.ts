import { createServerFn } from "@tanstack/react-start";
import {
  DEFAULT_PIPELINE_KEY,
  type DashboardPipelineKey,
} from "@/lib/access-control";
import { DASHBOARD_YEAR, DASHBOARD_DATA_VERSION, type DashboardPayload } from "@/lib/dashboard-payload";

export type { DashboardPayload } from "@/lib/dashboard-payload";
export { DASHBOARD_YEAR, createPlaceholderDashboard } from "@/lib/dashboard-payload";

export const getDashboardData = createServerFn({ method: "POST" })
  .validator((data: { pipeline?: DashboardPipelineKey }) => data ?? {})
  .handler(async ({ data }): Promise<DashboardPayload> => {
    const { getDashboardDataImpl } = await import("@/lib/fetch-dashboard.server");
    return getDashboardDataImpl(data.pipeline ?? DEFAULT_PIPELINE_KEY);
  });

/** Usado pelo cron da Vercel para manter o cache aquecido. */
export const warmDashboardCache = createServerFn({ method: "GET" })
  .validator((data: { pipeline?: DashboardPipelineKey }) => data ?? {})
  .handler(async ({ data }) => {
    const { warmDashboardCacheHandler } = await import("@/lib/fetch-dashboard.server");
    return warmDashboardCacheHandler(data.pipeline ?? DEFAULT_PIPELINE_KEY);
  });

export function dashboardQueryOptions(pipeline: DashboardPipelineKey = DEFAULT_PIPELINE_KEY) {
  return {
    queryKey: ["dashboard", DASHBOARD_YEAR, pipeline, DASHBOARD_DATA_VERSION] as const,
    queryFn: () => getDashboardData({ data: { pipeline } }),
    staleTime: 15 * 60 * 1_000,
    refetchOnWindowFocus: false as const,
    refetchInterval: (query: { state: { data?: DashboardPayload } }) => {
      const payload = query.state.data;
      return payload?.source === "unavailable" && !payload.error ? 2_000 : false;
    },
  };
}
