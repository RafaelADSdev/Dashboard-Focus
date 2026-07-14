import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
  MONTHS,
  MONTH_LABELS,
  PHASE_COLORS,
  PHASE_SHORT_LABELS,
  TEAM_ACCENT,
  initials,
  memberActiveTotal,
  memberPhaseValue,
  monthlyTrend,
  teamActiveTotal,
  teamPhaseTotal,
  type MonthFilter,
  type Phase,
  type Team,
} from "@/lib/teams-data";

export const Route = createFileRoute("/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Dashboard Comercial — Focus" },
      {
        name: "description",
        content: "Visão dos leads em cada equipe Focus e suas fases em 2026.",
      },
    ],
  }),
  component: Dashboard,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");

type MotionTier = "full" | "instant";

const MotionContext = createContext<MotionTier>("full");

function useMotionTier() {
  return useContext(MotionContext);
}

const LABEL_CHROME = "dash-label-chrome";

function Dashboard() {
  const placeholder = useMemo(() => createPlaceholderDashboard(), []);
  const { data, isFetching, isError, error } = useQuery({
    ...dashboardQueryOptions,
    placeholderData: placeholder,
  });
  const dashboardData = data ?? placeholder;
  const teams = dashboardData.teams ?? [];
  const isInitialLoad =
    isFetching && dashboardData.source === "unavailable" && !dashboardData.error && !isError;
  const [teamId, setTeamId] = useState<string>("overview");
  const [month, setMonth] = useState<MonthFilter>("all");
  const [motionTier, setMotionTier] = useState<MotionTier>("full");

  useEffect(() => {
    if (teamId !== "overview" && !teams.some((t) => t.id === teamId)) {
      setTeamId("overview");
    }
  }, [teams, teamId]);

  const handleMonthChange = useCallback((m: MonthFilter) => {
    setMotionTier("full");
    setMonth(m);
  }, []);

  const handleTeamChange = useCallback((id: string) => {
    setMotionTier("instant");
    setTeamId(id);
  }, []);

  const trend = useMemo(() => monthlyTrend(teams), [teams]);
  const trendMax = Math.max(...trend.map((t) => t.value), 1);
  const peakMonth = useMemo(
    () => trend.reduce((a, b) => (b.value > a.value ? b : a)).month,
    [trend],
  );

  return (
    <div className="dash-shell">
      <div className="flex h-full flex-col">
        <div className="dash-navbar w-full shrink-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-2 pt-3 md:px-6">
            <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
              <div>
                <p className={cn(LABEL_CHROME, "tracking-[0.2em]")}>
                  Reunião · Panorama Comercial 2026
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-wrap-balance">
                  Dashboard das Equipes Focus
                </h1>
                <p className="dashboard-source mt-1 text-xs">
                  Fonte:{" "}
                  {isInitialLoad ? (
                    <span className="text-slate-200">Carregando Bitrix…</span>
                  ) : dashboardData.source === "bitrix" ? (
                    <span className="text-emerald-200">Bitrix (webhook)</span>
                  ) : (
                    <span className="text-amber-200">dados locais</span>
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
                </p>
              </div>

              <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                <PeriodControls
                  month={month}
                  onMonthChange={handleMonthChange}
                  peakMonth={peakMonth}
                />
              </div>
            </header>

            <TeamTabNav teamId={teamId} teams={teams} onChange={handleTeamChange} />
          </div>
        </div>

        <div className="dash-content mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 pb-3 pt-3 md:px-6 md:pb-4">
          <MotionContext.Provider value={motionTier}>
            <AnimatedDashboardContent
              teamId={teamId}
              teams={teams}
              month={month}
              trend={trend}
              trendMax={trendMax}
              onPickMonth={handleMonthChange}
            />
          </MotionContext.Provider>
        </div>
      </div>
    </div>
  );
}

const GLASS_SURFACE = "dash-glass";

/** Coluna Neg. perd. — bordas e fundo só nesta célula, não em Prazos. */
const NEG_PERD_COL =
  "min-w-[5rem] w-[5rem] border-x border-red-300/60 bg-red-50/80 px-3 py-3 text-center tabular-nums dark:border-red-900/50 dark:bg-red-950/15";
const NEG_PERD_HEAD =
  "min-w-[5rem] w-[5rem] border-x border-red-300/60 border-b border-slate-200 bg-red-50/90 px-3 py-3 text-center font-medium text-red-700/90 dark:border-red-900/50 dark:border-b-white/10 dark:bg-red-950/20 dark:text-red-300/90";

const BROKER_TABLE_PHASE = "min-w-[4.25rem] px-2.5 py-3 text-center tabular-nums";
const BROKER_TABLE_PHASE_LAST = "min-w-[4.25rem] px-2.5 py-3 pr-8 text-center tabular-nums";
const BROKER_TABLE_LOST = "min-w-[4rem] px-3 py-3 text-center tabular-nums";
const BROKER_TABLE_ATIVO = "min-w-[4rem] px-3 py-3 text-center font-semibold tabular-nums";

function monthPresets(peakMonth: (typeof MONTHS)[number], year = 2026) {
  const currentMonth = String(
    new Date().getFullYear() === year ? new Date().getMonth() + 1 : 7,
  ).padStart(2, "0") as (typeof MONTHS)[number];

  return [
    { id: "all" as const, label: "Ano todo", value: "all" as MonthFilter },
    {
      id: "current" as const,
      label: "Mês atual",
      value: MONTHS.includes(currentMonth) ? currentMonth : "07",
    },
    { id: "peak" as const, label: "Pico", value: peakMonth },
  ];
}

function PeriodControls({
  month,
  onMonthChange,
  peakMonth,
  year = 2026,
}: {
  month: MonthFilter;
  onMonthChange: (m: MonthFilter) => void;
  peakMonth: (typeof MONTHS)[number];
  year?: number;
}) {
  const monthLabel = month === "all" ? "Ano todo" : MONTH_LABELS[month];
  const presets = monthPresets(peakMonth, year);

  const activePreset =
    month === "all"
      ? "all"
      : month === presets[1].value
        ? "current"
        : month === peakMonth
          ? "peak"
          : null;

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
      <span className="dash-chip" aria-live="polite">
        {year} · {monthLabel}
      </span>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atalhos de período">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onMonthChange(preset.value)}
            className={cn(
              "h-10 rounded-lg px-3 text-sm font-semibold",
              activePreset === preset.id ? "dash-btn-active" : "dash-btn-ghost",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <DashboardFilter
        month={month}
        onMonthChange={onMonthChange}
      />
    </div>
  );
}

function DashboardFilter({
  month,
  onMonthChange,
}: {
  month: MonthFilter;
  onMonthChange: (m: MonthFilter) => void;
}) {
  return (
    <Select value={month} onValueChange={(value) => onMonthChange(value as MonthFilter)}>
      <SelectTrigger
        className="dash-filter-trigger h-10 w-auto min-w-40 gap-2 border-white! bg-white! text-slate-900! shadow-none hover:bg-slate-100!"
        aria-label="Selecionar mês específico"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-700" aria-hidden />
        <span>{month === "all" ? "Mês específico" : `Mês · ${MONTH_LABELS[month]}`}</span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="end"
        className="border-slate-200 bg-white text-slate-900 shadow-sm"
      >
        {MONTHS.map((monthKey) => (
          <SelectItem key={monthKey} value={monthKey}>
            {MONTH_LABELS[monthKey]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TeamTabNav({
  teamId,
  teams,
  onChange,
}: {
  teamId: string;
  teams: Team[];
  onChange: (id: string) => void;
}) {
  const tabs = useMemo(
    () => [
      { id: "overview", label: "Visão Geral" },
      ...teams.map((t) => ({
        id: t.id,
        label: t.name,
      })),
    ],
    [teams],
  );

  return (
    <nav aria-label="Equipes" className="pb-1">
      <div role="tablist" className="inline-flex max-w-full flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = teamId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              onClick={() => onChange(tab.id)}
              className="nav-team-tab inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AnimatedDashboardContent({
  teamId,
  teams,
  month,
  trend,
  trendMax,
  onPickMonth,
}: {
  teamId: string;
  teams: Team[];
  month: MonthFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
}) {
  const selectedTeam = teamId === "overview" ? null : teams.find((t) => t.id === teamId);

  return (
    <div className="grid min-h-0 flex-1 [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:min-h-0">
      <div className="h-full min-h-0">
        {teamId === "overview" ? (
          <Overview
            teams={teams}
            month={month}
            trend={trend}
            trendMax={trendMax}
            onPickMonth={onPickMonth}
          />
        ) : selectedTeam ? (
          <TeamView team={selectedTeam} month={month} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Equipe não encontrada. Volte para Visão Geral.
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
                : "bg-violet-900/70 group-hover:bg-violet-700/80 dark:bg-violet-900/60 dark:group-hover:bg-violet-600/70",
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

function Overview({
  teams,
  month,
  trend,
  trendMax,
  onPickMonth,
}: {
  teams: Team[];
  month: MonthFilter;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
}) {
  const motionTier = useMotionTier();
  const teamTotals = teams.map((t) => ({
    team: t,
    active: teamActiveTotal(t, month),
  }));
  const phaseTotals = [...ACTIVE_PHASES, ...LOST_PHASES].map((p) => ({
    phase: p,
    value: teams.reduce((a, t) => a + teamPhaseTotal(t, p, month), 0),
  }));
  const activeSum = phaseTotals
    .filter((x) => ACTIVE_PHASES.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);
  const lostSum = phaseTotals
    .filter((x) => LOST_PHASES.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-6">
      <GlassKpiCard index={0} className="lg:col-span-3 lg:row-span-2">
        <p className={cn(LABEL_CHROME, "tracking-widest")}>
          {month === "all" ? "Funil ativo · 2026" : `Funil ativo · ${MONTH_LABELS[month]}/2026`}
        </p>
        <AnimatedNumber value={activeSum} className="mt-2 block text-5xl font-bold tabular-nums" />
        <p className="mt-1 text-xs text-slate-500">
          {teams.length} equipes · {teams.reduce((a, t) => a + t.members.length, 0)} corretores
        </p>
      </GlassKpiCard>

      {teamTotals.map(({ team, active }, index) => {
        const share = activeSum ? active / activeSum : 0;
        return (
          <GlassKpiCard key={team.id} index={index + 1} className="lg:col-span-3 lg:row-span-2">
            <p className={cn(LABEL_CHROME, "tracking-widest")}>{team.name}</p>
            <AnimatedNumber value={active} className="mt-2 block text-4xl font-bold tabular-nums" />
            <AnimatedShareBar
              share={share}
              accent={TEAM_ACCENT[team.id]}
              delay={(index + 1) * 90 + 180}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {team.members.length} corretores · {(share * 100).toFixed(1)}% do funil ativo
            </p>
          </GlassKpiCard>
        );
      })}

      <Card
        className={cn(motionTier === "full" && PANEL_ENTER, "lg:col-span-6 lg:row-span-4")}
        style={panelMotionClass(motionTier, "320ms")}
      >
        <div className="flex shrink-0 items-baseline justify-between gap-3">
          <div>
            <h2 className="dash-heading">Chegada de leads · 2026</h2>
            <p className="text-xs text-slate-500">
              Por mês de criação · sem leads = em branco
            </p>
          </div>
          {trend.some((t) => t.value > 0) && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pico: {MONTH_LABELS[trend.reduce((a, b) => (b.value > a.value ? b : a)).month]}
            </p>
          )}
        </div>
        <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-2">
          {trend.map((t, index) => (
            <TrendMonthColumn
              key={t.month}
              month={t.month}
              value={t.value}
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
          "lg:col-span-6 lg:row-span-4 min-h-0 overflow-y-auto",
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
              <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider")}>
                Funil ativo
              </h3>
              <AnimatedNumber
                value={activeSum}
                className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
              />
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

          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className={cn(LABEL_CHROME, "font-semibold tracking-wider text-red-400/90")}>
                Perdas
              </h3>
              <AnimatedNumber
                value={lostSum}
                className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
              />
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

function TeamView({ team, month }: { team: Team; month: MonthFilter }) {
  const motionTier = useMotionTier();
  const accent = TEAM_ACCENT[team.id];
  const activeSum = teamActiveTotal(team, month);

  const phaseTotals = [...ACTIVE_PHASES, ...LOST_PHASES].map((p) => ({
    phase: p,
    value: teamPhaseTotal(team, p, month),
  }));
  const lostSum = phaseTotals
    .filter((x) => LOST_PHASES.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);

  const members = [...team.members]
    .map((m) => ({ member: m, active: memberActiveTotal(m, month) }))
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

  const activePhasesBeforeAttendance = ACTIVE_PHASES.slice(
    0,
    ACTIVE_PHASES.indexOf(ATTENDANCE_STATUS_PHASES[0]),
  );
  const activePhasesAfterAttendance = ACTIVE_PHASES.slice(
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
        <div className="liquid-glass flex h-full justify-between gap-4 overflow-hidden rounded-2xl bg-white/20 p-4 text-slate-950 dark:bg-white/[0.035]">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-slate-900">Equipe</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">{team.name}</h2>
              <p className="text-xs text-slate-800">
                {team.members.length} corretores ·{" "}
                {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-slate-900">Funil ativo</p>
              <AnimatedNumber value={activeSum} className="text-4xl font-bold tabular-nums text-slate-950" />
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
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <div className={cn(LABEL_CHROME, "mb-1.5 flex justify-between font-semibold tracking-wider")}>
              <span>Funil ativo</span>
              <AnimatedNumber value={activeSum} className="tabular-nums" />
            </div>
            <StackedBar
              phases={ACTIVE_PHASES}
              totals={phaseTotals}
              total={activeSum}
              animateDelay={260}
            />
            <div className="mt-2">
              <PhaseLegend
                phases={ACTIVE_PHASES}
                totals={phaseTotals}
                total={activeSum}
                animateDelay={340}
                sections={ACTIVE_FUNNEL_LEGEND_SECTIONS}
              />
            </div>
          </div>
          <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0 dark:border-slate-800">
            <div className={cn(LABEL_CHROME, "mb-1.5 flex justify-between font-semibold tracking-wider text-red-400/90")}>
              <span>Perdas</span>
              <AnimatedNumber value={lostSum} className="tabular-nums text-slate-600 dark:text-slate-300" />
            </div>
            <StackedBar
              phases={LOST_PHASES}
              totals={phaseTotals}
              total={lostSum}
              animateDelay={400}
            />
            <div className="mt-2">
              <PhaseLegend
                phases={LOST_PHASES}
                totals={phaseTotals}
                total={lostSum}
                animateDelay={480}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card
        glass
        className={cn(motionTier === "full" && PANEL_ENTER, "lg:col-span-12 lg:row-span-4 min-h-0")}
        style={panelMotionClass(motionTier, "240ms")}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="dash-heading">Por etapa · corretor</h3>
          <p className="text-xs text-slate-400">Funil ativo · perdas separadas</p>
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
                {LOST_PHASES.map((p, phaseIndex) => (
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
                    {ACTIVE_PHASES.map((p, phaseIndex) => {
                      const v = memberPhaseValue(member, p, month);
                      return (
                        <td
                          key={p}
                          className={cn(
                            phaseIndex === ACTIVE_PHASES.length - 1
                              ? BROKER_TABLE_PHASE_LAST
                              : BROKER_TABLE_PHASE,
                            v ? "text-slate-700 dark:text-slate-200" : "text-slate-500",
                          )}
                        >
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    {LOST_PHASES.map((p, phaseIndex) => {
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
                    colSpan={ACTIVE_PHASES.length + LOST_PHASES.length + 3}
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
  accent,
  glass = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
  glass?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "liquid-glass relative flex min-h-0 flex-col overflow-hidden rounded-2xl p-4",
        glass ? GLASS_SURFACE : "dash-panel",
        className,
      )}
      style={style}
    >
      {accent && <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />}
      {children}
    </div>
  );
}

function GlassKpiCard({
  children,
  className = "",
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  const motionTier = useMotionTier();

  return (
    <div
      className={cn(
        "liquid-glass relative flex min-h-0 flex-col overflow-hidden rounded-2xl p-4",
        motionTier === "full" &&
          "kpi-enter motion-safe:animate-[kpi-enter_0.55s_cubic-bezier(0.16,1,0.3,1)_both] motion-safe:transition-[border-color,background-color] motion-safe:duration-300",
        GLASS_SURFACE,
        className,
      )}
      style={motionTier === "full" ? { animationDelay: `${index * 80}ms` } : undefined}
    >
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
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
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
