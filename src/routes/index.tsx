import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDashboardData } from "@/lib/fetch-dashboard";
import {
  ACTIVE_PHASES,
  LOST_PHASES,
  MONTHS,
  MONTH_LABELS,
  PHASE_COLORS,
  TEAM_ACCENT,
  grandTotal,
  initials,
  memberPhaseValue,
  memberTotal,
  monthlyTrend,
  teamPhaseTotal,
  teamTotal,
  type MonthFilter,
  type Phase,
  type Team,
} from "@/lib/teams-data";

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
  loader: async () => getDashboardData(),
  component: Dashboard,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");

function Dashboard() {
  const data = Route.useLoaderData();
  const teams = data.teams;
  const [teamId, setTeamId] = useState<string>("overview");
  const [month, setMonth] = useState<MonthFilter>("all");

  const total = grandTotal(teams, month);
  const trend = useMemo(() => monthlyTrend(teams), [teams]);
  const trendMax = Math.max(...trend.map((t) => t.value), 1);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col px-4 py-4 md:px-6 md:py-5">
        <header className="flex flex-wrap items-end justify-between gap-4 pb-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400">
              Reunião · Panorama Comercial 2026
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Dashboard das Equipes Focus
            </h1>
            <p className="mt-1 text-[11px] text-slate-500">
              Fonte:{" "}
              {data.source === "bitrix" ? (
                <span className="text-emerald-400">Bitrix (webhook)</span>
              ) : (
                <span className="text-amber-400">dados locais</span>
              )}
              {data.error ? <span className="text-red-400"> · {data.error}</span> : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterGroup label="Ano">
              <PillButton active>2026</PillButton>
            </FilterGroup>
            <FilterGroup label="Mês">
              <PillButton active={month === "all"} onClick={() => setMonth("all")}>
                Ano todo
              </PillButton>
              {MONTHS.map((m) => (
                <PillButton key={m} active={month === m} onClick={() => setMonth(m)}>
                  {MONTH_LABELS[m]}
                </PillButton>
              ))}
            </FilterGroup>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 pb-3">
          <TabButton active={teamId === "overview"} onClick={() => setTeamId("overview")}>
            Visão Geral
          </TabButton>
          {teams.map((t) => (
            <TabButton
              key={t.id}
              active={teamId === t.id}
              onClick={() => setTeamId(t.id)}
              accent={TEAM_ACCENT[t.id]}
            >
              {t.name}
            </TabButton>
          ))}
        </nav>

        <div className="min-h-0 flex-1">
          {teamId === "overview" ? (
            <Overview
              teams={teams}
              month={month}
              total={total}
              trend={trend}
              trendMax={trendMax}
              onPickMonth={setMonth}
            />
          ) : (
            <TeamView team={teams.find((t) => t.id === teamId)!} month={month} />
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-2 py-1">
      <span className="pl-1 pr-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function PillButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-1 text-xs font-medium transition " +
        (active
          ? "bg-slate-100 text-slate-900 shadow"
          : "text-slate-300 hover:bg-slate-800 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function TabButton({
  children,
  active,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-4 py-1.5 text-sm font-medium transition " +
        (active
          ? `bg-gradient-to-r ${accent ?? "from-slate-100 to-slate-300"} text-slate-900 shadow-lg`
          : "border border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

function PhaseLegend({
  phases,
  totals,
  total,
}: {
  phases: Phase[];
  totals: { phase: Phase; value: number }[];
  total: number;
}) {
  const map = new Map(totals.map((t) => [t.phase, t.value]));
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {phases.map((phase) => {
        const value = map.get(phase) ?? 0;
        return (
          <div key={phase} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: PHASE_COLORS[phase] }}
              />
              <span className="truncate text-slate-300">{phase}</span>
            </span>
            <span className="tabular-nums text-white">
              {value > 0 ? (
                <>
                  {fmt(value)}
                  <span className="ml-1 text-[10px] text-slate-500">
                    {total ? ((value / total) * 100).toFixed(0) : 0}%
                  </span>
                </>
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StackedBar({
  phases,
  totals,
  total,
}: {
  phases: Phase[];
  totals: { phase: Phase; value: number }[];
  total: number;
}) {
  const map = new Map(totals.map((t) => [t.phase, t.value]));
  if (!total) {
    return <div className="h-2.5 w-full rounded-full bg-slate-800/80" />;
  }
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
      {phases.map((phase) => {
        const value = map.get(phase) ?? 0;
        if (!value) return null;
        return (
          <div
            key={phase}
            title={`${phase}: ${fmt(value)}`}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: PHASE_COLORS[phase],
            }}
          />
        );
      })}
    </div>
  );
}

function Overview({
  teams,
  month,
  total,
  trend,
  trendMax,
  onPickMonth,
}: {
  teams: Team[];
  month: MonthFilter;
  total: number;
  trend: { month: (typeof MONTHS)[number]; value: number }[];
  trendMax: number;
  onPickMonth: (m: MonthFilter) => void;
}) {
  const teamTotals = teams.map((t) => ({ team: t, total: teamTotal(t, month) }));
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
      <Card className="lg:col-span-3 lg:row-span-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">
          {month === "all" ? "Total de leads · 2026" : `Leads · ${MONTH_LABELS[month]}/2026`}
        </p>
        <p className="mt-2 text-5xl font-bold tabular-nums">{fmt(total)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {teams.length} equipes · {teams.reduce((a, t) => a + t.members.length, 0)} corretores
        </p>
      </Card>

      {teamTotals.map(({ team, total: tt }) => (
        <Card key={team.id} className="lg:col-span-3 lg:row-span-2" accent={TEAM_ACCENT[team.id]}>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">{team.name}</p>
          <p className="mt-2 text-4xl font-bold tabular-nums">{fmt(tt)}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full bg-gradient-to-r ${TEAM_ACCENT[team.id]}`}
              style={{ width: `${total ? (tt / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {team.members.length} corretores · {total ? ((tt / total) * 100).toFixed(1) : "0"}% do
            total
          </p>
        </Card>
      ))}

      <Card className="lg:col-span-6 lg:row-span-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold">Chegada de leads · 2026</h2>
            <p className="text-xs text-slate-500">
              Por mês de criação · sem leads = em branco
            </p>
          </div>
          {trend.some((t) => t.value > 0) && (
            <p className="text-[11px] text-slate-500">
              Pico: {MONTH_LABELS[trend.reduce((a, b) => (b.value > a.value ? b : a)).month]}
            </p>
          )}
        </div>
        <div className="mt-4 flex h-[calc(100%-3.5rem)] items-end gap-2">
          {trend.map((t) => {
            const empty = t.value === 0;
            const pct = empty ? 0 : (t.value / trendMax) * 100;
            const active = month === t.month;
            return (
              <button
                key={t.month}
                onClick={() => onPickMonth(active ? "all" : t.month)}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className={
                    "text-[10px] font-medium tabular-nums " +
                    (empty ? "text-slate-700" : "text-slate-400 group-hover:text-white")
                  }
                >
                  {empty ? "—" : fmt(t.value)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  {empty ? (
                    <div className="w-full border-t border-dashed border-slate-700/80" />
                  ) : (
                    <div
                      className={
                        "w-full rounded-t-md transition " +
                        (active
                          ? "bg-gradient-to-t from-indigo-500 to-fuchsia-400"
                          : "bg-slate-700 group-hover:bg-slate-500")
                      }
                      style={{ height: `${pct}%` }}
                    />
                  )}
                </div>
                <span
                  className={
                    "text-[11px] " + (active ? "font-semibold text-white" : "text-slate-500")
                  }
                >
                  {MONTH_LABELS[t.month]}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="lg:col-span-6 lg:row-span-4 min-h-0 overflow-y-auto">
        <h2 className="text-sm font-semibold">Distribuição por fase</h2>
        <p className="text-xs text-slate-500">
          {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`} · perdas separadas
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Funil ativo
              </h3>
              <span className="text-[11px] tabular-nums text-slate-500">{fmt(activeSum)}</span>
            </div>
            <StackedBar phases={ACTIVE_PHASES} totals={phaseTotals} total={activeSum} />
            <div className="mt-3">
              <PhaseLegend phases={ACTIVE_PHASES} totals={phaseTotals} total={activeSum} />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-red-400/90">
                Perdas
              </h3>
              <span className="text-[11px] tabular-nums text-slate-500">{fmt(lostSum)}</span>
            </div>
            <StackedBar phases={LOST_PHASES} totals={phaseTotals} total={lostSum} />
            <div className="mt-3">
              <PhaseLegend phases={LOST_PHASES} totals={phaseTotals} total={lostSum} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BrokerAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  return (
    <Avatar className="h-8 w-8 border border-slate-700">
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-slate-300">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function TeamView({ team, month }: { team: Team; month: MonthFilter }) {
  const accent = TEAM_ACCENT[team.id];
  const tTotal = teamTotal(team, month);

  const phaseTotals = [...ACTIVE_PHASES, ...LOST_PHASES].map((p) => ({
    phase: p,
    value: teamPhaseTotal(team, p, month),
  }));
  const activeSum = phaseTotals
    .filter((x) => ACTIVE_PHASES.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);
  const lostSum = phaseTotals
    .filter((x) => LOST_PHASES.includes(x.phase))
    .reduce((a, x) => a + x.value, 0);

  const members = [...team.members]
    .map((m) => ({ member: m, total: memberTotal(m, month) }))
    .sort((a, b) => b.total - a.total);

  const shortLabel = (p: Phase) => {
    const map: Partial<Record<Phase, string>> = {
      "Tentativa de Contato": "Tentativa",
      "Atendimentos Agendados": "Agendados",
      "Atendimentos Realizados": "Realizados",
      "Em Atendimento": "Em atend.",
      Propostas: "Propostas",
      "Contratos Assinados": "Contratos",
      "Negócios Perdidos": "Neg. perd.",
      "Prazos Perdidos": "Prazos",
    };
    return map[p] ?? p;
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-6">
      <div className={`rounded-2xl bg-gradient-to-br p-[1px] ${accent} lg:col-span-4 lg:row-span-2`}>
        <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950/85 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Equipe</p>
            <h2 className="mt-1 text-2xl font-bold">{team.name}</h2>
            <p className="text-xs text-slate-500">
              {team.members.length} corretores ·{" "}
              {month === "all" ? "Ano de 2026" : `${MONTH_LABELS[month]}/2026`}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Total de leads</p>
            <p className="text-4xl font-bold tabular-nums">{fmt(tTotal)}</p>
          </div>
        </div>
      </div>

      <Card className="lg:col-span-8 lg:row-span-2 min-h-0 overflow-y-auto">
        <h3 className="text-sm font-semibold">Distribuição por fase</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
              <span>Funil ativo</span>
              <span className="tabular-nums">{fmt(activeSum)}</span>
            </div>
            <StackedBar phases={ACTIVE_PHASES} totals={phaseTotals} total={activeSum} />
            <div className="mt-2">
              <PhaseLegend phases={ACTIVE_PHASES} totals={phaseTotals} total={activeSum} />
            </div>
          </div>
          <div className="border-t border-slate-800 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <div className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-red-400/90">
              <span>Perdas</span>
              <span className="tabular-nums text-slate-400">{fmt(lostSum)}</span>
            </div>
            <StackedBar phases={LOST_PHASES} totals={phaseTotals} total={lostSum} />
            <div className="mt-2">
              <PhaseLegend phases={LOST_PHASES} totals={phaseTotals} total={lostSum} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-12 lg:row-span-4 min-h-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Por etapa · corretor</h3>
          <p className="text-[11px] text-slate-500">Foto do Bitrix · perdas à direita</p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-8 py-2 text-left">#</th>
                <th className="py-2 text-left">Corretor</th>
                {ACTIVE_PHASES.map((p) => (
                  <th key={p} className="px-1 py-2 text-right font-medium" title={p}>
                    {shortLabel(p)}
                  </th>
                ))}
                <th className="w-2 border-l border-slate-700/80" />
                {LOST_PHASES.map((p) => (
                  <th
                    key={p}
                    className="px-1 py-2 text-right font-medium text-red-400/80"
                    title={p}
                  >
                    {shortLabel(p)}
                  </th>
                ))}
                <th className="w-14 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {members.map(({ member, total }, idx) => {
                if (month !== "all" && total === 0) {
                  return (
                    <tr key={member.name} className="border-t border-slate-800/40">
                      <td className="py-2 text-slate-600 tabular-nums">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2 opacity-40">
                          <BrokerAvatar name={member.name} photoUrl={member.photoUrl} />
                          <span className="font-medium text-slate-500">{member.name}</span>
                        </div>
                      </td>
                      {ACTIVE_PHASES.map((p) => (
                        <td key={p} className="px-1 py-2 text-right text-slate-700">
                          —
                        </td>
                      ))}
                      <td className="border-l border-slate-800/60" />
                      {LOST_PHASES.map((p) => (
                        <td key={p} className="px-1 py-2 text-right text-slate-700">
                          —
                        </td>
                      ))}
                      <td className="py-2 text-right text-slate-600">—</td>
                    </tr>
                  );
                }
                return (
                  <tr key={member.name} className="border-t border-slate-800/70">
                    <td className="py-2 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <BrokerAvatar name={member.name} photoUrl={member.photoUrl} />
                        <span className="font-medium text-slate-100">{member.name}</span>
                      </div>
                    </td>
                    {ACTIVE_PHASES.map((p) => {
                      const v = memberPhaseValue(member, p, month);
                      return (
                        <td
                          key={p}
                          className={
                            "px-1 py-2 text-right tabular-nums " +
                            (v ? "text-slate-200" : "text-slate-700")
                          }
                        >
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="border-l border-slate-700/60" />
                    {LOST_PHASES.map((p) => {
                      const v = memberPhaseValue(member, p, month);
                      return (
                        <td
                          key={p}
                          className={
                            "px-1 py-2 text-right tabular-nums " +
                            (v ? "text-red-300/90" : "text-slate-700")
                          }
                        >
                          {v ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {total ? fmt(total) : "—"}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={ACTIVE_PHASES.length + LOST_PHASES.length + 4}
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
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg " +
        className
      }
    >
      {accent && <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />}
      {children}
    </div>
  );
}
