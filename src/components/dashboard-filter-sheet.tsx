import { CalendarDays, Check, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DASHBOARD_PIPELINES,
  isFocusMainTeamId,
  isPrimeiraChaveTeamId,
  type DashboardPipelineKey,
  type DiretoriaFilter,
} from "@/lib/access-control";
import { MONTHS, MONTH_LABELS, type MonthFilter, type Team } from "@/lib/teams-data";
import { cn } from "@/lib/utils";

export type { DiretoriaFilter };

export type DashboardFilters = {
  pipeline: DashboardPipelineKey;
  teamId: string;
  month: MonthFilter;
  diretoria: DiretoriaFilter;
};

const DIRETORIA_OPTIONS: { id: DiretoriaFilter; label: string }[] = [
  { id: "all", label: "Todas as diretorias" },
  { id: "focus", label: "Focus" },
  { id: "primeira_chave", label: "focus - primeira chave" },
];

type DatePresetId = "all" | "current" | "peak";

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

export function DashboardFilterSheet({
  open,
  onOpenChange,
  applied,
  onApply,
  teams,
  canSwitchPipeline,
  peakMonth,
  year = 2026,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applied: DashboardFilters;
  onApply: (filters: DashboardFilters) => void;
  teams: Team[];
  canSwitchPipeline: boolean;
  peakMonth: (typeof MONTHS)[number];
  year?: number;
}) {
  const presets = useMemo(() => monthPresets(peakMonth, year), [peakMonth, year]);
  const [draft, setDraft] = useState<DashboardFilters>(applied);
  const [datePreset, setDatePreset] = useState<DatePresetId>("all");

  useEffect(() => {
    if (!open) return;
    setDraft(applied);
    const preset =
      presets.find((item) => item.value === applied.month)?.id ?? ("all" as DatePresetId);
    setDatePreset(preset);
  }, [open, applied, presets]);

  function setDiretoria(value: DiretoriaFilter) {
    setDraft((prev) => {
      const focus = teams.filter((t) => isFocusMainTeamId(t.id));
      const primeiraChave = teams.filter((t) => isPrimeiraChaveTeamId(t.id));
      const scopedTeams =
        value === "all" ? [...focus, ...primeiraChave] : value === "focus" ? focus : primeiraChave;
      const scopedIds = new Set(["overview", ...scopedTeams.map((t) => t.id)]);
      const teamId = scopedIds.has(prev.teamId) ? prev.teamId : "overview";
      return { ...prev, diretoria: value, teamId };
    });
  }

  function setPreset(preset: DatePresetId) {
    setDatePreset(preset);
    const match = presets.find((item) => item.id === preset);
    if (match) setDraft((prev) => ({ ...prev, month: match.value }));
  }

  const monthTo = draft.month === "all" ? "12" : draft.month;

  function handleClear() {
    const cleared: DashboardFilters = {
      pipeline: applied.pipeline,
      teamId: "overview",
      month: "all",
      diretoria: "all",
    };
    setDraft(cleared);
    setDatePreset("all");
    onApply(cleared);
    onOpenChange(false);
  }

  function handleApply() {
    onApply(draft);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="filter-sheet flex w-full max-w-[22rem] flex-col gap-0 border-slate-200 p-0 sm:max-w-[22rem]"
      >
        <div className="filter-sheet-header">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-amber-500" aria-hidden />
            <SheetTitle className="filter-sheet-title">Filtros</SheetTitle>
          </div>
        </div>

        <div className="filter-sheet-body">
          <section className="filter-sheet-section">
            <div className="filter-preset-row" role="group" aria-label="Atalhos de período">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={datePreset === preset.id}
                  onClick={() => setPreset(preset.id)}
                  className={cn(
                    "filter-preset-pill",
                    datePreset === preset.id && "filter-preset-pill--active",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="filter-field-row mt-4">
              <label className="filter-field">
                <span className="filter-field-label">De</span>
                <div className="filter-input-wrap">
                  <Select
                    value={draft.month === "all" ? "01" : draft.month}
                    onValueChange={(value) => {
                      setDatePreset("current");
                      setDraft((prev) => ({ ...prev, month: value as MonthFilter }));
                    }}
                  >
                    <SelectTrigger className="filter-select-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((monthKey) => (
                        <SelectItem key={monthKey} value={monthKey}>
                          {MONTH_LABELS[monthKey]}/{year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CalendarDays className="filter-input-icon" aria-hidden />
                </div>
              </label>

              <label className="filter-field">
                <span className="filter-field-label">Até</span>
                <div className="filter-input-wrap">
                  <Select
                    value={monthTo}
                    onValueChange={(value) => {
                      setDatePreset("current");
                      setDraft((prev) => ({ ...prev, month: value as MonthFilter }));
                    }}
                  >
                    <SelectTrigger className="filter-select-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((monthKey) => (
                        <SelectItem key={monthKey} value={monthKey}>
                          {MONTH_LABELS[monthKey]}/{year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CalendarDays className="filter-input-icon" aria-hidden />
                </div>
              </label>
            </div>
          </section>

          {canSwitchPipeline ? (
            <section className="filter-sheet-section">
              <label className="filter-field">
                <span className="filter-field-label">Esteira</span>
                <Select
                  value={draft.pipeline}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      pipeline: value as DashboardPipelineKey,
                      teamId: "overview",
                    }))
                  }
                >
                  <SelectTrigger className="filter-select-trigger w-full">
                    <SelectValue placeholder="Todas as esteiras" />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_PIPELINES.map((pipeline) => (
                      <SelectItem key={pipeline.key} value={pipeline.key}>
                        {pipeline.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </section>
          ) : null}

          <section className="filter-sheet-section">
            <label className="filter-field">
              <span className="filter-field-label">Diretoria</span>
              <Select value={draft.diretoria} onValueChange={(value) => setDiretoria(value as DiretoriaFilter)}>
                <SelectTrigger className="filter-select-trigger w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRETORIA_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </section>
        </div>

        <div className="filter-sheet-footer">
          <button type="button" className="filter-btn-clear" onClick={handleClear}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Limpar filtros
          </button>
          <button type="button" className="filter-btn-apply" onClick={handleApply}>
            <Check className="h-4 w-4" aria-hidden />
            Aplicar filtros
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardFilterTrigger({
  onClick,
  activeCount = 0,
}: {
  onClick: () => void;
  activeCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dash-btn-ghost relative inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold"
      aria-label="Abrir filtros"
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
      Filtros
      {activeCount > 0 ? (
        <span className="filter-trigger-badge" aria-hidden>
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}
