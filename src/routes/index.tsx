import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Repeat2, Shield } from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoginScreen } from "@/components/login-screen";
import {
  AccessManagementScreen,
  AccessPendingScreen,
  AccessSetupRequiredScreen,
} from "@/components/access-management-screen";
import {
  DashboardFilterSheet,
  DashboardFilterTrigger,
  type DashboardFilters,
  type DiretoriaFilter,
} from "@/components/dashboard-filter-sheet";
import { useAuth } from "@/lib/auth";
import { AccessProvider, useAccess } from "@/lib/access";
import {
  DASHBOARD_PIPELINES,
  DEFAULT_PIPELINE_KEY,
  filterTeamsByDiretoria,
  isPrimeiraChaveTeamId,
  isFocusMainTeamId,
  focusMainTeamTabLabel,
  isTeamVisibleInPipeline,
  resolveDashboardPipeline,
  type DashboardPipelineKey,
} from "@/lib/access-control";
import { cn } from "@/lib/utils";
import {
  createPlaceholderDashboard,
  dashboardQueryOptions,
} from "@/lib/fetch-dashboard";
import {
  ACTIVE_FUNNEL_LEGEND_SECTIONS,
  ACTIVE_PHASES,
  ATTENDANCE_STATUS_GROUP_LABEL,
  ATTENDANCE_STATUS_PHASES,
  LOST_PHASES,
  getActivePhases,
  getFunnelLegendSections,
  getLostPhases,
  MONTHS,
  MONTH_LABELS,
  PHASE_COLORS,
  PHASE_SHORT_LABELS,
  TEAM_ACCENT,
  TEAM_ACCENT_SOFT,
  TEAM_HERO_GLASS,
  initials,
  memberActiveTotal,
  memberPhaseValue,
  monthlyTrend,
  teamActiveTotal,
  teamBrokerCount,
  teamBrokerMembers,
  teamPhaseTotal,
  type MonthFilter,
  type Phase,
  type Team,
} from "@/lib/teams-data";

const PIPELINE_STORAGE_KEY = "focus-dashboard-pipeline";

function readStoredPipeline(): DashboardPipelineKey | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(PIPELINE_STORAGE_KEY);
  if (stored === "comercial_geral" || stored === "economico") {
    return stored;
  }
  return null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Comercial — Focus" },
      {
        name: "description",
        content: "Visão dos leads em cada equipe Focus e suas fases em 2026.",
      },
    ],
  }),
  component: DashboardApp,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");

type MotionTier = "full" | "instant";

const MotionContext = createContext<MotionTier>("full");

function useMotionTier() {
  return useContext(MotionContext);
}

const LABEL_CHROME = "dash-label-chrome";

function DashboardApp() {
  const { session, loading, configured, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <main className="login-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/70">Carregando sessão…</p>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen configured={configured} onSignIn={signIn} />;
  }

  return (
    <AccessProvider
      userId={session.user.id}
      userEmail={session.user.email}
      accessToken={session.access_token}
    >
      <AuthenticatedApp userEmail={session.user.email} onSignOut={signOut} />
    </AccessProvider>
  );
}

function AuthenticatedApp({
  userEmail,
  onSignOut,
}: {
  userEmail?: string | null;
  onSignOut: () => Promise<void>;
}) {
  const { loading, ready, setupRequired, profile, isAdministrator } = useAccess();
  const [appView, setAppView] = useState<"dashboard" | "access">("dashboard");

  if (loading || !ready) {
    return (
      <main className="login-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/70">Carregando permissões…</p>
      </main>
    );
  }

  if (setupRequired) {
    return <AccessSetupRequiredScreen />;
  }

  if (!profile) {
    return <AccessPendingScreen email={userEmail} />;
  }

  if (appView === "access" && isAdministrator) {
    return <AccessManagementScreen onBack={() => setAppView("dashboard")} />;
  }

  return (
    <Dashboard
      userEmail={userEmail}
      onSignOut={onSignOut}
      isAdministrator={isAdministrator}
      onOpenAccessManagement={() => setAppView("access")}
    />
  );
}

function Dashboard({
  userEmail,
  onSignOut,
  isAdministrator,
  onOpenAccessManagement,
}: {
  userEmail?: string | null;
  onSignOut: () => Promise<void>;
  isAdministrator: boolean;
  onOpenAccessManagement: () => void;
}) {
  const { canAccessTeam, allowedPages, canSwitchPipeline, allowedPipeline, canAccessPipeline } =
    useAccess();
  const [pipelineKey, setPipelineKey] = useState<DashboardPipelineKey>(() => {
    const stored = readStoredPipeline();
    if (stored && (canSwitchPipeline || stored === allowedPipeline)) {
      return stored;
    }
    return resolveDashboardPipeline(allowedPipeline);
  });
  const activePipeline: DashboardPipelineKey = canSwitchPipeline
    ? pipelineKey
    : resolveDashboardPipeline(allowedPipeline);

  const placeholder = useMemo(
    () => createPlaceholderDashboard(activePipeline),
    [activePipeline],
  );

  useEffect(() => {
    if (!canSwitchPipeline) {
      setPipelineKey(resolveDashboardPipeline(allowedPipeline));
    }
  }, [allowedPipeline, canSwitchPipeline]);

  useEffect(() => {
    if (!canAccessPipeline(activePipeline)) {
      setPipelineKey(resolveDashboardPipeline(allowedPipeline));
    }
  }, [activePipeline, allowedPipeline, canAccessPipeline]);

  useEffect(() => {
    if (!canSwitchPipeline) return;
    localStorage.setItem(PIPELINE_STORAGE_KEY, pipelineKey);
  }, [canSwitchPipeline, pipelineKey]);

  const { data, isFetching, isError, error } = useQuery({
    ...dashboardQueryOptions(activePipeline),
    placeholderData: (previous) =>
      previous?.pipeline === activePipeline ? previous : placeholder,
  });

  const dashboardData =
    data?.pipeline === activePipeline ? data : placeholder;
  const teams = useMemo(
    () =>
      (dashboardData.teams ?? []).filter(
        (team) =>
          isTeamVisibleInPipeline(team.id, activePipeline) && canAccessTeam(team.id),
      ),
    [dashboardData.teams, activePipeline, canAccessTeam],
  );
  const isInitialLoad =
    isFetching && dashboardData.source === "unavailable" && !dashboardData.error && !isError;
  const [teamId, setTeamId] = useState<string>("overview");
  const [month, setMonth] = useState<MonthFilter>("all");
  const [diretoria, setDiretoria] = useState<DiretoriaFilter>("all");
  const [motionTier, setMotionTier] = useState<MotionTier>("full");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (teamId !== "overview" && !teams.some((t) => t.id === teamId)) {
      setTeamId(canAccessTeam("overview") ? "overview" : (teams[0]?.id ?? "overview"));
    }
  }, [teams, teamId, canAccessTeam]);

  const handleMonthChange = useCallback((m: MonthFilter) => {
    setMotionTier("full");
    setMonth(m);
  }, []);

  const handleTeamChange = useCallback((id: string) => {
    if (!canAccessTeam(id)) return;
    setMotionTier("instant");
    setTeamId(id);
  }, [canAccessTeam]);

  const handlePipelineChange = useCallback((pipeline: DashboardPipelineKey) => {
    if (!canAccessPipeline(pipeline)) return;
    setMotionTier("full");
    setPipelineKey(pipeline);
    setTeamId("overview");
  }, [canAccessPipeline]);

  const handleFiltersApply = useCallback(
    (filters: DashboardFilters) => {
      if (filters.pipeline !== activePipeline) {
        if (!canAccessPipeline(filters.pipeline)) return;
        setMotionTier("full");
        setPipelineKey(filters.pipeline);
      } else {
        setMotionTier(filters.teamId === "overview" ? "full" : "instant");
      }
      setMonth(filters.month);
      setTeamId(canAccessTeam(filters.teamId) ? filters.teamId : "overview");
      setDiretoria(filters.diretoria);
    },
    [activePipeline, canAccessPipeline, canAccessTeam],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (month !== "all") count += 1;
    if (teamId !== "overview") count += 1;
    if (diretoria !== "all") count += 1;
    return count;
  }, [month, teamId, diretoria]);

  const trendTeams = useMemo(() => {
    if (teamId !== "overview") {
      const selected = teams.find((team) => team.id === teamId);
      return selected ? [selected] : teams;
    }
    if (activePipeline === "economico") {
      return filterTeamsByDiretoria(teams, diretoria);
    }
    return teams;
  }, [teams, teamId, activePipeline, diretoria]);

  const trend = useMemo(() => monthlyTrend(trendTeams, activePipeline), [trendTeams, activePipeline]);
  const trendMax = Math.max(...trend.map((t) => t.value), 1);
  const peakMonth = useMemo(
    () => trend.reduce((a, b) => (b.value > a.value ? b : a)).month,
    [trend],
  );

  const accessibleTeamIds = useMemo(
    () => ["overview", ...teams.map((team) => team.id)].filter((id) => canAccessTeam(id)),
    [teams, canAccessTeam],
  );

  useEffect(() => {
    if (accessibleTeamIds.length === 0) return;
    if (!canAccessTeam(teamId)) {
      setTeamId(accessibleTeamIds[0]);
    }
  }, [teamId, canAccessTeam, accessibleTeamIds]);

  if (allowedPages.length === 0) {
    return <AccessPendingScreen email={userEmail} />;
  }

  return (
    <div className="dash-shell">
      <div className="dash-navbar w-full shrink-0">
          <div className="dash-layout-wrap py-2">
            <header className="flex flex-col gap-2">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-wrap-balance sm:text-2xl">
                  Dashboard Comercial
                </h1>
                <p className="dashboard-source mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <PipelineBadge pipeline={activePipeline} />
                  <span className="hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="hidden sm:inline">
                    Fonte:{" "}
                    {isInitialLoad ? (
                      <span className="text-slate-200">Carregando Bitrix…</span>
                    ) : dashboardData.source === "bitrix" ? (
                      <span className="text-emerald-200">Bitrix (webhook)</span>
                    ) : dashboardData.error ? (
                      <span className="text-red-200">Bitrix indisponível</span>
                    ) : (
                      <span className="text-amber-200">aguardando dados</span>
                    )}
                    {isFetching && !isInitialLoad ? (
                      <span className="text-slate-300"> · atualizando</span>
                    ) : null}
                    {dashboardData.error ? (
                      <span className="text-red-200"> · {dashboardData.error}</span>
                    ) : isError ? (
                      <span className="text-red-200">
                        {" "}
                        · {error instanceof Error ? error.message : "Falha ao carregar dados"}
                      </span>
                    ) : null}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  {canAccessTeam("overview") ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teamId === "overview"}
                      onClick={() => handleTeamChange("overview")}
                      className="dash-view-tab"
                    >
                      Visão Geral
                    </button>
                  ) : null}
                  {canSwitchPipeline ? (
                    <PipelineSwitcher
                      pipeline={activePipeline}
                      onChange={handlePipelineChange}
                      canAccessPipeline={canAccessPipeline}
                    />
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
                  <DashboardFilterTrigger
                    activeCount={activeFilterCount}
                    onClick={() => setFiltersOpen(true)}
                  />
                  {isAdministrator ? (
                    <button
                      type="button"
                      onClick={onOpenAccessManagement}
                      className="dash-btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold"
                      aria-label="Gestão de acesso"
                    >
                      <Shield className="h-4 w-4 shrink-0" aria-hidden />
                      Acessos
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="dash-btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold"
                    aria-label={userEmail ? `Sair da conta ${userEmail}` : "Sair"}
                    title={userEmail ?? undefined}
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                    Sair
                  </button>
                </div>
              </div>
            </header>

            <DashboardFilterSheet
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              applied={{
                pipeline: activePipeline,
                teamId,
                month,
                diretoria,
              }}
              onApply={handleFiltersApply}
              teams={teams}
              canSwitchPipeline={canSwitchPipeline}
              peakMonth={peakMonth}
            />
          </div>
        </div>

        <div className="dash-content dash-layout-wrap flex min-h-0 flex-1 flex-col pb-3 pt-3 md:pb-4">
          <MotionContext.Provider value={motionTier}>
            <AnimatedDashboardContent
              teamId={teamId}
              teams={teams}
              month={month}
              pipeline={activePipeline}
              diretoria={diretoria}
              trend={trend}
              trendMax={trendMax}
              onPickMonth={handleMonthChange}
              onTeamSelect={handleTeamChange}
            />
          </MotionContext.Provider>
        </div>
    </div>
  );
}

const KPI_METRIC = "dash-kpi-metric mt-2 block text-3xl font-bold tabular-nums text-slate-900";

function TeamGlassKpiCard({
  team,
  active,
  share,
  index,
  className,
  onSelect,
}: {
  team: Team;
  active: number;
  share: number;
  index: number;
  className?: string;
  onSelect?: () => void;
}) {
  return (
    <GlassKpiCard
      index={index}
      tint={TEAM_ACCENT_SOFT[team.id]}
      className={className}
      onClick={onSelect}
      ariaLabel={`Ver equipe ${team.name}`}
    >
      <p className={cn(LABEL_CHROME, "truncate tracking-widest")}>{team.name}</p>
      <AnimatedNumber value={active} className={KPI_METRIC} />
      <AnimatedShareBar
        share={share}
        accent={TEAM_ACCENT[team.id]}
        delay={index * 90 + 180}
      />
      <p className="dash-kpi-footnote mt-1 text-xs text-slate-500">
        {teamBrokerCount(team)} corretores · {(share * 100).toFixed(1)}% do funil ativo
      </p>
    </GlassKpiCard>
  );
}

function PipelineBadge({ pipeline }: { pipeline: DashboardPipelineKey }) {
  if (pipeline === "economico") {
    return (
      <span className="pipeline-badge pipeline-badge--economico">
        <span className="pipeline-badge__dot" aria-hidden />
        Esteira Econômico
      </span>
    );
  }

  return (
    <span className="pipeline-badge pipeline-badge--comercial-geral">
      <span className="pipeline-badge__dot" aria-hidden />
      Esteira Comercial Geral
    </span>
  );
}
const NEG_PERD_COL =
  "min-w-[5rem] w-[5rem] border-x border-red-300/60 bg-red-50/80 px-3 py-3 text-center tabular-nums dark:border-red-900/50 dark:bg-red-950/15";
const NEG_PERD_HEAD =
  "min-w-[5rem] w-[5rem] border-x border-red-300/60 border-b border-slate-200 bg-red-50/90 px-3 py-3 text-center font-medium text-red-700/90 dark:border-red-900/50 dark:border-b-white/10 dark:bg-red-950/20 dark:text-red-300/90";

const BROKER_TABLE_PHASE = "min-w-[4.25rem] px-2.5 py-3 text-center tabular-nums";
const BROKER_TABLE_PHASE_LAST = "min-w-[4.25rem] px-2.5 py-3 pr-8 text-center tabular-nums";
const BROKER_TABLE_LOST = "min-w-[4rem] px-3 py-3 text-center tabular-nums";
const BROKER_TABLE_ATIVO = "min-w-[4rem] px-3 py-3 text-center font-semibold tabular-nums";

function PipelineSwitcher({
  pipeline,
  onChange,
  canAccessPipeline,
}: {
  pipeline: DashboardPipelineKey;
  onChange: (pipeline: DashboardPipelineKey) => void;
  canAccessPipeline: (pipelineKey: DashboardPipelineKey) => boolean;
}) {
  const availablePipelines = DASHBOARD_PIPELINES.filter((item) => canAccessPipeline(item.key));
  if (availablePipelines.length <= 1) return null;

  return (
    <nav
      aria-label="Alternar esteira"
      className="inline-flex h-10 max-w-full items-center gap-1 rounded-lg border border-white/15 bg-white/10 p-1"
    >
      <span className="hidden items-center gap-1 px-2 text-xs font-semibold text-white/80 sm:inline-flex">
        <Repeat2 className="h-3.5 w-3.5" aria-hidden />
        Esteira
      </span>
      {availablePipelines.map((item) => {
        const active = pipeline === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold motion-safe:transition-colors",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-white/85 hover:bg-white/10",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function AnimatedDashboardContent({
  teamId,
  teams,
  month,
  pipeline,
  diretoria,
  trend,
  trendMax,
  onPickMonth,
  onTeamSelect,
}: {
  teamId: string;
  teams: Team[];
  month: MonthFilter;
  pipeline: DashboardPipelineKey;
  diretoria: DiretoriaFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
  onTeamSelect: (id: string) => void;
}) {
  const selectedTeam = teamId === "overview" ? null : teams.find((t) => t.id === teamId);
  const isScrollableOverview = teamId === "overview" && pipeline === "economico";

  return (
    <div
      className={cn(
        isScrollableOverview
          ? "pb-1"
          : "grid min-h-0 min-h-full flex-1 [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:min-h-0",
      )}
    >
      <div className={cn(!isScrollableOverview && "h-full min-h-0")}>
        {teamId === "overview" ? (
          <Overview
            teams={teams}
            month={month}
            pipeline={pipeline}
            diretoria={diretoria}
            trend={trend}
            trendMax={trendMax}
            onPickMonth={onPickMonth}
            onTeamSelect={onTeamSelect}
          />
        ) : selectedTeam ? (
          <TeamView team={selectedTeam} month={month} pipeline={pipeline} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Você não tem permissão para ver esta equipe.
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseLegendRow({
  phase,
  value,
  total,
  visible,
  rowDelay,
}: {
  phase: Phase;
  value: number;
  total: number;
  visible: boolean;
  rowDelay?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        rowDelay !== undefined &&
          "motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
      )}
      style={rowDelay !== undefined ? { transitionDelay: `${rowDelay}ms` } : undefined}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: PHASE_COLORS[phase] }}
        />
        <span className="truncate text-slate-600 dark:text-slate-300">
          {PHASE_SHORT_LABELS[phase]}
        </span>
      </span>
      <span className="tabular-nums text-slate-900 dark:text-white">
        {value > 0 ? (
          <>
            <AnimatedNumber value={value} className="inline" />
            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
              {total ? ((value / total) * 100).toFixed(0) : 0}%
            </span>
          </>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </span>
    </div>
  );
}

function PhaseLegend({
  phases,
  totals,
  total,
  animateDelay,
  sections,
}: {
  phases: Phase[];
  totals: { phase: Phase; value: number }[];
  total: number;
  animateDelay?: number;
  sections?: typeof ACTIVE_FUNNEL_LEGEND_SECTIONS;
}) {
  const motionTier = useMotionTier();
  const effectiveDelay = motionTier === "full" ? animateDelay : undefined;
  const map = new Map(totals.map((t) => [t.phase, t.value]));
  const [visible, setVisible] = useState(effectiveDelay === undefined);

  useEffect(() => {
    if (effectiveDelay === undefined) {
      setVisible(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), effectiveDelay);
    return () => window.clearTimeout(timer);
  }, [effectiveDelay, total]);

  if (sections) {
    let rowIndex = 0;
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {sections.map((section) => (
          <Fragment key={section.label ?? section.phases.join("|")}>
            {section.label ? (
              <p className={cn(LABEL_CHROME, "col-span-2 font-semibold tracking-wider")}>
                {section.label}
              </p>
            ) : null}
            {section.phases.map((phase) => {
              const delay = effectiveDelay !== undefined ? rowIndex++ * 45 : undefined;
              return (
                <PhaseLegendRow
                  key={phase}
                  phase={phase}
                  value={map.get(phase) ?? 0}
                  total={total}
                  visible={visible}
                  rowDelay={delay}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {phases.map((phase, index) => {
        const delay = effectiveDelay !== undefined ? index * 45 : undefined;
        return (
          <PhaseLegendRow
            key={phase}
            phase={phase}
            value={map.get(phase) ?? 0}
            total={total}
            visible={visible}
            rowDelay={delay}
          />
        );
      })}
    </div>
  );
}

function StackedBar({
  phases,
  totals,
  total,
  animateDelay,
}: {
  phases: Phase[];
  totals: { phase: Phase; value: number }[];
  total: number;
  animateDelay?: number;
}) {
  const motionTier = useMotionTier();
  const effectiveDelay = motionTier === "full" ? animateDelay : undefined;
  const map = new Map(totals.map((t) => [t.phase, t.value]));
  const [ready, setReady] = useState(effectiveDelay === undefined);

  useEffect(() => {
    if (effectiveDelay === undefined) {
      setReady(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setReady(true);
      return;
    }
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), effectiveDelay);
    return () => window.clearTimeout(timer);
  }, [effectiveDelay, total]);

  if (!total) {
    return <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-violet-950/80" />;
  }

  let segmentIndex = 0;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-violet-950/70">
      {phases.map((phase) => {
        const value = map.get(phase) ?? 0;
        if (!value) return null;
        const delay = segmentIndex * 55;
        segmentIndex += 1;
        return (
          <div
            key={phase}
            title={`${phase}: ${fmt(value)}`}
            className="h-full origin-left motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              width: ready ? `${(value / total) * 100}%` : "0%",
              backgroundColor: PHASE_COLORS[phase],
              transitionDelay: effectiveDelay !== undefined ? `${delay}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function TrendMonthColumn({
  month: monthKey,
  value,
  trendMax,
  selectedMonth,
  index,
  onPickMonth,
}: {
  month: (typeof MONTHS)[number];
  value: number;
  trendMax: number;
  selectedMonth: MonthFilter;
  index: number;
  onPickMonth: (m: MonthFilter) => void;
}) {
  const motionTier = useMotionTier();
  const empty = value === 0;
  const pct = empty ? 0 : Math.max((value / trendMax) * 100, 4);
  const active = selectedMonth === monthKey;
  const [barHeight, setBarHeight] = useState(pct);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || motionTier === "instant") {
      setBarHeight(pct);
      return;
    }
    setBarHeight(0);
    const timer = window.setTimeout(() => setBarHeight(pct), 360 + index * 45);
    return () => window.clearTimeout(timer);
  }, [pct, index, motionTier]);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${MONTH_LABELS[monthKey]}${empty ? ", sem leads" : `, ${fmt(value)} leads`}`}
      onClick={() => onPickMonth(active ? "all" : monthKey)}
      className="group flex min-h-0 flex-1 flex-col items-center gap-1 rounded-sm motion-safe:transition-colors motion-safe:duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
    >
      <span
        className={cn(
          "shrink-0 text-xs font-medium tabular-nums",
          empty ? "text-slate-500" : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-white",
        )}
      >
        {empty ? "—" : <AnimatedNumber value={value} className="inline" />}
      </span>
      <div className="relative min-h-0 w-full flex-1">
        {empty ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-slate-300 dark:border-slate-700/80" />
        ) : (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-t-md motion-safe:transition-[height,background-color] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
              active
                ? "bg-gradient-to-t from-violet-600 to-purple-400"
                : "bg-violet-200 group-hover:bg-violet-300",
            )}
            style={{ height: `${barHeight}%` }}
          />
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-[11px]",
          active ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500",
        )}
      >
        {MONTH_LABELS[monthKey]}
      </span>
    </button>
  );
}

const PANEL_ENTER =
  "kpi-enter motion-safe:animate-[kpi-enter_0.55s_cubic-bezier(0.16,1,0.3,1)_both]";

function panelMotionClass(motionTier: MotionTier, delay?: string) {
  if (motionTier !== "full") return undefined;
  return delay ? { animationDelay: delay } : undefined;
}

function OverviewAnalyticsSection({
  month,
  trend,
  trendMax,
  onPickMonth,
  phaseTotals,
  activeSum,
  lostSum,
  motionTier,
  activePhases,
  lostPhases,
  legendSections,
}: {
  month: MonthFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
  phaseTotals: { phase: Phase; value: number }[];
  activeSum: number;
  lostSum: number;
  motionTier: MotionTier;
  activePhases: Phase[];
  lostPhases: Phase[];
  legendSections: typeof ACTIVE_FUNNEL_LEGEND_SECTIONS;
}) {
  return (
    <div className="grid dash-chart-grid">
      <Card
        className={cn(
          motionTier === "full" && PANEL_ENTER,
          "dash-chart-card dash-chart-card--lavender",
        )}
        style={panelMotionClass(motionTier, "280ms")}
      >
        <div className="flex shrink-0 items-baseline justify-between gap-3">
          <div>
            <h2 className="dash-heading">Chegada de leads · 2026</h2>
            <p className="text-xs text-slate-500">Por mês de criação · sem leads = em branco</p>
          </div>
          {trend.some((item) => item.value > 0) ? (
            <p className="text-xs text-slate-500">
              Pico: {MONTH_LABELS[trend.reduce((a, b) => (b.value > a.value ? b : a)).month]}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex min-h-[10rem] flex-1 items-stretch gap-1.5 sm:gap-2">
          {trend.map((item, index) => (
            <TrendMonthColumn
              key={item.month}
              month={item.month}
              value={item.value}
              trendMax={trendMax}
              selectedMonth={month}
              index={index}
              onPickMonth={onPickMonth}
            />
          ))}
        </div>
      </Card>

      <Card
        className={cn(
          motionTier === "full" && PANEL_ENTER,
          "dash-chart-card dash-chart-card--sky min-h-0 overflow-y-auto",
        )}
        style={panelMotionClass(motionTier, "360ms")}
      >
        <h2 className="dash-heading">Distribuição por fase</h2>
        <p className="text-xs text-slate-500">
          {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`}
          {lostPhases.length > 0 ? " · perdas separadas" : ""}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider")}>Funil ativo</h3>
              <AnimatedNumber value={activeSum} className="text-xs tabular-nums text-slate-500" />
            </div>
            <StackedBar
              phases={activePhases}
              totals={phaseTotals}
              total={activeSum}
              animateDelay={480}
            />
            <div className="mt-3">
              <PhaseLegend
                phases={activePhases}
                totals={phaseTotals}
                total={activeSum}
                animateDelay={560}
                sections={legendSections}
              />
            </div>
          </div>

          {lostPhases.length > 0 ? (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider text-red-400/90")}>
                  Perdas
                </h3>
                <AnimatedNumber value={lostSum} className="text-xs tabular-nums text-slate-500" />
              </div>
              <StackedBar
                phases={lostPhases}
                totals={phaseTotals}
                total={lostSum}
                animateDelay={620}
              />
              <div className="mt-3">
                <PhaseLegend
                  phases={lostPhases}
                  totals={phaseTotals}
                  total={lostSum}
                  animateDelay={700}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ComercialGeralOverview({
  teams,
  month,
  trend,
  trendMax,
  onPickMonth,
  onTeamSelect,
}: {
  teams: Team[];
  month: MonthFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
  onTeamSelect: (id: string) => void;
}) {
  const motionTier = useMotionTier();
  const teamTotals = teams.map((team) => ({
    team,
    active: teamActiveTotal(team, month),
  }));
  const phaseTotals = [...ACTIVE_PHASES, ...LOST_PHASES].map((phase) => ({
    phase,
    value: teams.reduce((sum, team) => sum + teamPhaseTotal(team, phase, month), 0),
  }));
  const activeSum = phaseTotals
    .filter((item) => ACTIVE_PHASES.includes(item.phase))
    .reduce((sum, item) => sum + item.value, 0);
  const lostSum = phaseTotals
    .filter((item) => LOST_PHASES.includes(item.phase))
    .reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-6">
      <GlassKpiCard
        index={0}
        tint="from-violet-500/12 via-white to-white"
        className="lg:col-span-3 lg:row-span-2"
      >
        <p className={cn(LABEL_CHROME, "tracking-widest")}>
          {month === "all" ? "Funil ativo · 2026" : `Funil ativo · ${MONTH_LABELS[month]}/2026`}
        </p>
        <AnimatedNumber value={activeSum} className={KPI_METRIC} />
        <p className="mt-1 text-xs text-slate-500">
          {teams.length} equipes · {teams.reduce((sum, team) => sum + teamBrokerCount(team), 0)} corretores
        </p>
      </GlassKpiCard>

      {teamTotals.map(({ team, active }, index) => {
        const share = activeSum ? active / activeSum : 0;
        return (
          <TeamGlassKpiCard
            key={team.id}
            team={team}
            active={active}
            share={share}
            index={index + 1}
            className="lg:col-span-3 lg:row-span-2"
            onSelect={() => onTeamSelect(team.id)}
          />
        );
      })}

      <Card
        className={cn(
          motionTier === "full" && PANEL_ENTER,
          "dash-chart-card dash-chart-card--lavender lg:col-span-6 lg:row-span-4",
        )}
        style={panelMotionClass(motionTier, "320ms")}
      >
        <div className="flex shrink-0 items-baseline justify-between gap-3">
          <div>
            <h2 className="dash-heading">Chegada de leads · 2026</h2>
            <p className="text-xs text-slate-500">Por mês de criação · sem leads = em branco</p>
          </div>
          {trend.some((item) => item.value > 0) ? (
            <p className="text-xs text-slate-500">
              Pico: {MONTH_LABELS[trend.reduce((a, b) => (b.value > a.value ? b : a)).month]}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex min-h-[10rem] flex-1 items-stretch gap-1.5 sm:gap-2">
          {trend.map((item, index) => (
            <TrendMonthColumn
              key={item.month}
              month={item.month}
              value={item.value}
              trendMax={trendMax}
              selectedMonth={month}
              index={index}
              onPickMonth={onPickMonth}
            />
          ))}
        </div>
      </Card>

      <Card
        className={cn(
          motionTier === "full" && PANEL_ENTER,
          "dash-chart-card dash-chart-card--sky lg:col-span-6 lg:row-span-4 min-h-0 overflow-y-auto",
        )}
        style={panelMotionClass(motionTier, "400ms")}
      >
        <h2 className="dash-heading">Distribuição por fase</h2>
        <p className="text-xs text-slate-500">
          {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`} · perdas separadas
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider")}>Funil ativo</h3>
              <AnimatedNumber value={activeSum} className="text-xs tabular-nums text-slate-500" />
            </div>
            <StackedBar
              phases={ACTIVE_PHASES}
              totals={phaseTotals}
              total={activeSum}
              animateDelay={480}
            />
            <div className="mt-3">
              <PhaseLegend
                phases={ACTIVE_PHASES}
                totals={phaseTotals}
                total={activeSum}
                animateDelay={560}
                sections={ACTIVE_FUNNEL_LEGEND_SECTIONS}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider text-red-400/90")}>
                Perdas
              </h3>
              <AnimatedNumber value={lostSum} className="text-xs tabular-nums text-slate-500" />
            </div>
            <StackedBar
              phases={LOST_PHASES}
              totals={phaseTotals}
              total={lostSum}
              animateDelay={620}
            />
            <div className="mt-3">
              <PhaseLegend
                phases={LOST_PHASES}
                totals={phaseTotals}
                total={lostSum}
                animateDelay={700}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EconomicoOverview({
  teams,
  month,
  trend,
  trendMax,
  onPickMonth,
  onTeamSelect,
}: {
  teams: Team[];
  month: MonthFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
  onTeamSelect: (id: string) => void;
}) {
  const motionTier = useMotionTier();
  const activePhases = getActivePhases("economico");
  const lostPhases = getLostPhases("economico");
  const legendSections = getFunnelLegendSections("economico");
  const orderedTeams = useMemo(() => {
    const focus = teams.filter((team) => isFocusMainTeamId(team.id));
    const primeiraChave = teams.filter((team) => isPrimeiraChaveTeamId(team.id));
    return [...focus, ...primeiraChave];
  }, [teams]);
  const phaseTotals = [...activePhases, ...lostPhases].map((phase) => ({
    phase,
    value: teams.reduce((sum, team) => sum + teamPhaseTotal(team, phase, month), 0),
  }));
  const activeSum = phaseTotals
    .filter((item) => activePhases.includes(item.phase))
    .reduce((sum, item) => sum + item.value, 0);
  const lostSum = phaseTotals
    .filter((item) => lostPhases.includes(item.phase))
    .reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col gap-2.5 pb-1 min-w-0 w-full">
      <div className="dash-kpi-grid dash-kpi-grid--row">
        <GlassKpiCard index={0} tint="from-violet-500/12 via-white to-white">
          <p className={cn(LABEL_CHROME, "truncate tracking-widest")}>
            {month === "all" ? "Funil ativo · 2026" : `Funil ativo · ${MONTH_LABELS[month]}/2026`}
          </p>
          <AnimatedNumber value={activeSum} className={KPI_METRIC} />
          <p className="dash-kpi-footnote mt-1 text-xs text-slate-500">
            {teams.length} equipes · {teams.reduce((sum, team) => sum + teamBrokerCount(team), 0)} corretores
          </p>
        </GlassKpiCard>

        {orderedTeams.map((team, index) => {
          const active = teamActiveTotal(team, month, "economico");
          const share = activeSum ? active / activeSum : 0;
          return (
            <TeamGlassKpiCard
              key={team.id}
              team={team}
              active={active}
              share={share}
              index={index + 1}
              onSelect={() => onTeamSelect(team.id)}
            />
          );
        })}
      </div>

      <OverviewAnalyticsSection
        month={month}
        trend={trend}
        trendMax={trendMax}
        onPickMonth={onPickMonth}
        phaseTotals={phaseTotals}
        activeSum={activeSum}
        lostSum={lostSum}
        motionTier={motionTier}
        activePhases={activePhases}
        lostPhases={lostPhases}
        legendSections={legendSections}
      />
    </div>
  );
}

function Overview({
  teams,
  month,
  pipeline,
  diretoria,
  trend,
  trendMax,
  onPickMonth,
  onTeamSelect,
}: {
  teams: Team[];
  month: MonthFilter;
  pipeline: DashboardPipelineKey;
  diretoria: DiretoriaFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
  onTeamSelect: (id: string) => void;
}) {
  const scopedTeams =
    pipeline === "economico" ? filterTeamsByDiretoria(teams, diretoria) : teams;

  if (pipeline === "economico") {
    return (
      <EconomicoOverview
        teams={scopedTeams}
        month={month}
        trend={trend}
        trendMax={trendMax}
        onPickMonth={onPickMonth}
        onTeamSelect={onTeamSelect}
      />
    );
  }

  return (
    <ComercialGeralOverview
      teams={scopedTeams}
      month={month}
      trend={trend}
      trendMax={trendMax}
      onPickMonth={onPickMonth}
      onTeamSelect={onTeamSelect}
    />
  );
}

function BrokerAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  return (
    <Avatar className="h-8 w-8 shrink-0 border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800/80">
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback className="bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function TeamLeaderPortrait({ leader }: { leader: Team["leader"] }) {
  const name = leader?.name ?? "Líder não definido";

  return (
    <div className="flex w-28 shrink-0 flex-col items-center justify-center text-center text-slate-950">
      <Avatar className="h-20 w-20 border-2 border-white/80 bg-white/70 shadow-sm">
        {leader?.photoUrl ? <AvatarImage src={leader.photoUrl} alt={name} className="object-cover" /> : null}
        <AvatarFallback className="bg-white/80 text-lg font-bold text-slate-800">
          {leader ? initials(name) : "?"}
        </AvatarFallback>
      </Avatar>
      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-tight">{name}</p>
    </div>
  );
}

function TeamView({
  team,
  month,
  pipeline = "comercial_geral",
}: {
  team: Team;
  month: MonthFilter;
  pipeline?: DashboardPipelineKey;
}) {
  const motionTier = useMotionTier();
  const accent = TEAM_ACCENT[team.id];
  const isPrimeiraChave = isPrimeiraChaveTeamId(team.id);
  const isEconomico = pipeline === "economico";
  const activePhases = getActivePhases(pipeline);
  const lostPhases = getLostPhases(pipeline);
  const legendSections = getFunnelLegendSections(pipeline);
  const activeSum = teamActiveTotal(team, month, pipeline);

  const phaseTotals = [...activePhases, ...lostPhases].map((p) => ({
    phase: p,
    value: teamPhaseTotal(team, p, month),
  }));
  const lostSum = phaseTotals
    .filter((x) => lostPhases.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);

  const members = [...teamBrokerMembers(team)]
    .map((m) => ({ member: m, active: memberActiveTotal(m, month, pipeline) }))
    .sort((a, b) => {
      const aOnTeam = a.member.active !== false;
      const bOnTeam = b.member.active !== false;
      if (aOnTeam !== bOnTeam) return aOnTeam ? -1 : 1;
      return b.active - a.active;
    });

  const phaseHeaderLabel = (p: Phase) => {
    const map: Partial<Record<Phase, string>> = {
      "Em Atendimento": "Em atendimento",
      "Em Quarentena": "Em quarentena",
      Standby: "Standby",
      "Negócios Perdidos": "Neg. perdidos",
      "Prazos Perdidos": "Prazos perd.",
    };
    return map[p] ?? PHASE_SHORT_LABELS[p] ?? p;
  };

  const activePhasesBeforeAttendance = isEconomico
    ? []
    : ACTIVE_PHASES.slice(0, ACTIVE_PHASES.indexOf(ATTENDANCE_STATUS_PHASES[0]));
  const activePhasesAfterAttendance = isEconomico
    ? []
    : ACTIVE_PHASES.slice(
        ACTIVE_PHASES.indexOf(ATTENDANCE_STATUS_PHASES[ATTENDANCE_STATUS_PHASES.length - 1]) + 1,
      );

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-6">
      <div
        className={cn(
          motionTier === "full" && PANEL_ENTER,
          "rounded-2xl bg-gradient-to-br p-[1px] lg:col-span-4 lg:row-span-2",
          accent,
        )}
        style={panelMotionClass(motionTier, "80ms")}
      >
        <div
          className={cn(
            "dash-team-hero liquid-glass flex h-full justify-between gap-4 overflow-hidden rounded-xl p-4 text-slate-950",
            "border border-white/55 bg-gradient-to-br",
            TEAM_HERO_GLASS[team.id] ?? "from-violet-500/24 via-white/42 to-white/16",
          )}
        >
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              {pipeline === "economico" && isPrimeiraChave ? (
                <p className="text-[11px] font-semibold tracking-wide text-violet-600">
                  Focus Primeira Chave
                </p>
              ) : isFocusMainTeamId(team.id) ? (
                <p className="text-[11px] font-semibold tracking-wide text-violet-600">Focus</p>
              ) : (
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">Equipe</p>
              )}
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                {isFocusMainTeamId(team.id) ? focusMainTeamTabLabel(team.name) : team.name}
              </h2>
              <p className="text-xs text-slate-600">
                {teamBrokerCount(team)} corretores ·{" "}
                {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-500">Funil ativo</p>
              <AnimatedNumber value={activeSum} className="text-3xl font-bold tabular-nums text-slate-900" />
            </div>
          </div>
          <TeamLeaderPortrait leader={team.leader} />
        </div>
      </div>

      <Card
        className={cn(motionTier === "full" && PANEL_ENTER, "lg:col-span-8 lg:row-span-2 min-h-0 overflow-y-auto")}
        style={panelMotionClass(motionTier, "160ms")}
      >
        <h3 className="dash-heading">Distribuição por fase</h3>
        <div className={cn("mt-3 grid gap-4", lostPhases.length > 0 ? "md:grid-cols-2" : "")}>
          <div>
            <div className={cn(LABEL_CHROME, "mb-1.5 flex justify-between font-semibold tracking-wider")}>
              <span>Funil ativo</span>
              <AnimatedNumber value={activeSum} className="tabular-nums" />
            </div>
            <StackedBar
              phases={activePhases}
              totals={phaseTotals}
              total={activeSum}
              animateDelay={260}
            />
            <div className="mt-2">
              <PhaseLegend
                phases={activePhases}
                totals={phaseTotals}
                total={activeSum}
                animateDelay={340}
                sections={legendSections}
              />
            </div>
          </div>
          {lostPhases.length > 0 ? (
            <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0 dark:border-slate-800">
              <div className={cn(LABEL_CHROME, "mb-1.5 flex justify-between font-semibold tracking-wider text-red-400/90")}>
                <span>Perdas</span>
                <AnimatedNumber value={lostSum} className="tabular-nums text-slate-600 dark:text-slate-300" />
              </div>
              <StackedBar
                phases={lostPhases}
                totals={phaseTotals}
                total={lostSum}
                animateDelay={400}
              />
              <div className="mt-2">
                <PhaseLegend
                  phases={lostPhases}
                  totals={phaseTotals}
                  total={lostSum}
                  animateDelay={480}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card
        className={cn(motionTier === "full" && PANEL_ENTER, "lg:col-span-12 lg:row-span-4 min-h-0")}
        style={panelMotionClass(motionTier, "240ms")}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="dash-heading">Por etapa · corretor</h3>
          <p className="text-xs text-slate-400">
            Funil ativo{lostPhases.length > 0 ? " · perdas separadas" : ""}
          </p>
        </div>
        <div
          className="dash-table-wrap"
          tabIndex={0}
          aria-label="Tabela de corretores — role para ver todas as colunas"
        >
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-xs">
            <thead className="dash-table-head">
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th
                  rowSpan={2}
                  scope="col"
                  className="w-9 border-b border-slate-200 px-2.5 py-3 text-center font-medium dark:border-white/10"
                >
                  #
                </th>
                <th
                  rowSpan={2}
                  scope="col"
                  className="min-w-[11rem] border-b border-slate-200 px-3 py-3 text-left font-medium dark:border-white/10"
                >
                  Corretor
                </th>
                {isEconomico
                  ? activePhases.map((p) => (
                      <th
                        key={p}
                        rowSpan={2}
                        scope="col"
                        className="border-b border-slate-200 px-2.5 py-3 text-center font-medium dark:border-white/10"
                        title={p}
                      >
                        {phaseHeaderLabel(p)}
                      </th>
                    ))
                  : null}
                {!isEconomico ? (
                  <>
                    {activePhasesBeforeAttendance.map((p) => (
                      <th
                        key={p}
                        rowSpan={2}
                        scope="col"
                        className="border-b border-slate-200 px-2.5 py-3 text-center font-medium dark:border-white/10"
                        title={p}
                      >
                        {phaseHeaderLabel(p)}
                      </th>
                    ))}
                    <th
                      colSpan={ATTENDANCE_STATUS_PHASES.length}
                      scope="colgroup"
                      className="border-b border-slate-200 px-2.5 py-2 text-center text-[11px] font-semibold tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-300"
                    >
                      {ATTENDANCE_STATUS_GROUP_LABEL}
                    </th>
                    {activePhasesAfterAttendance.map((p, phaseIndex) => (
                      <th
                        key={p}
                        rowSpan={2}
                        scope="col"
                        className={cn(
                          "border-b border-slate-200 font-medium dark:border-white/10",
                          phaseIndex === activePhasesAfterAttendance.length - 1
                            ? BROKER_TABLE_PHASE_LAST
                            : BROKER_TABLE_PHASE,
                        )}
                        title={p}
                      >
                        {phaseHeaderLabel(p)}
                      </th>
                    ))}
                  </>
                ) : null}
                {lostPhases.map((p, phaseIndex) => (
                  <th
                    key={p}
                    rowSpan={2}
                    scope="col"
                    className={cn(
                      phaseIndex === 0
                        ? NEG_PERD_HEAD
                        : cn(
                            BROKER_TABLE_LOST,
                            "border-b border-slate-200 font-medium text-slate-500 dark:border-white/10 dark:text-slate-400",
                          ),
                    )}
                    title={p}
                  >
                    {phaseHeaderLabel(p)}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  scope="col"
                  className={cn(
                    BROKER_TABLE_ATIVO,
                    "border-b border-slate-200 font-medium text-slate-600 dark:border-white/10 dark:text-slate-300",
                  )}
                >
                  Ativo
                </th>
              </tr>
              {!isEconomico ? (
                <tr className="border-b border-slate-200 dark:border-white/10">
                  {ATTENDANCE_STATUS_PHASES.map((p, phaseIndex) => (
                    <th
                      key={p}
                      scope="col"
                      className={cn(
                        "border-b border-slate-200 font-medium dark:border-white/10",
                        phaseIndex === ATTENDANCE_STATUS_PHASES.length - 1
                          ? BROKER_TABLE_PHASE_LAST
                          : BROKER_TABLE_PHASE,
                      )}
                      title={p}
                    >
                      {phaseHeaderLabel(p)}
                    </th>
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {members.map(({ member, active }, idx) => {
                const empty = month !== "all" && active === 0;
                const departed = member.active === false;
                return (
                  <tr
                    key={member.bitrixId ?? member.name}
                    className={cn(
                      "border-t border-slate-100 motion-safe:transition-colors motion-safe:duration-150 dark:border-white/5",
                      motionTier === "full" &&
                        "team-row-enter motion-safe:animate-[panel-enter_0.4s_cubic-bezier(0.16,1,0.3,1)_both]",
                      empty ? "opacity-50" : "hover:bg-slate-100/80 dark:hover:bg-white/[0.03]",
                    )}
                    style={motionTier === "full" ? { animationDelay: `${320 + idx * 40}ms` } : undefined}
                  >
                    <td className="px-2.5 py-3 text-center tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-3 pr-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <BrokerAvatar name={member.name} photoUrl={member.photoUrl} />
                        <span
                          className={cn(
                            "truncate font-medium",
                            departed
                              ? "text-slate-500"
                              : empty
                                ? "text-slate-500"
                                : "text-slate-800 dark:text-slate-100",
                          )}
                          title={departed ? "Saiu da equipe Focus" : undefined}
                        >
                          {member.name}
                        </span>
                      </div>
                    </td>
                    {activePhases.map((p, phaseIndex) => {
                      const v = memberPhaseValue(member, p, month);
                      return (
                        <td
                          key={p}
                          className={cn(
                            phaseIndex === activePhases.length - 1 && lostPhases.length === 0
                              ? BROKER_TABLE_PHASE_LAST
                              : BROKER_TABLE_PHASE,
                            v ? "text-slate-700 dark:text-slate-200" : "text-slate-500",
                          )}
                        >
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    {lostPhases.map((p, phaseIndex) => {
                      const v = memberPhaseValue(member, p, month);
                      if (phaseIndex === 0) {
                        return (
                          <td
                            key={p}
                            className={cn(
                              NEG_PERD_COL,
                              v ? "text-red-600 dark:text-red-300" : "text-slate-500",
                            )}
                          >
                            {v ? fmt(v) : "—"}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={p}
                          className={cn(
                            BROKER_TABLE_LOST,
                            v ? "text-slate-600 dark:text-slate-400" : "text-slate-500",
                          )}
                        >
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    <td className={cn(BROKER_TABLE_ATIVO, "text-slate-800 dark:text-slate-100")}>
                      {active ? fmt(active) : "—"}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={activePhases.length + lostPhases.length + 3}
                    className="py-6 text-center text-slate-500"
                  >
                    Sem corretores nesta equipe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "dash-panel relative flex min-h-0 flex-col overflow-hidden rounded-xl p-3",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function GlassKpiCard({
  children,
  className = "",
  index = 0,
  tint,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  tint?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const motionTier = useMotionTier();
  const classNames = cn(
    "dash-kpi-card liquid-glass",
    tint && `bg-gradient-to-br ${tint}`,
    motionTier === "full" &&
      "kpi-enter motion-safe:animate-[kpi-enter_0.55s_cubic-bezier(0.16,1,0.3,1)_both]",
    onClick &&
      "cursor-pointer appearance-none font-inherit text-left text-inherit transition hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
    className,
  );
  const style = motionTier === "full" ? { animationDelay: `${index * 80}ms` } : undefined;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classNames}
        style={style}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classNames} style={style}>
      {children}
    </div>
  );
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const motionTier = useMotionTier();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || motionTier === "instant") {
      setDisplay(value);
      prev.current = value;
      return;
    }

    const from = prev.current;
    const to = value;
    prev.current = value;
    const start = performance.now();
    const duration = 650;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, motionTier]);

  return <span className={className}>{fmt(display)}</span>;
}

function AnimatedShareBar({
  share,
  accent,
  delay,
}: {
  share: number;
  accent: string;
  delay: number;
}) {
  const motionTier = useMotionTier();
  const [width, setWidth] = useState(share * 100);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = share * 100;
    if (reduced || motionTier === "instant") {
      setWidth(target);
      return;
    }
    setWidth(0);
    const timer = window.setTimeout(() => setWidth(target), delay);
    return () => window.clearTimeout(timer);
  }, [share, delay, motionTier]);

  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full bg-gradient-to-r motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
          accent,
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
