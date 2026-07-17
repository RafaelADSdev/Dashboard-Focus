import type { DashboardPipelineKey } from "@/lib/access-control";

export type Phase =
  | "Atendimentos Agendados"
  | "Atendimentos Realizados"
  | "Contratos Assinados"
  | "Em Atendimento"
  | "Em Quarentena"
  | "Standby"
  | "Negócios Perdidos"
  | "Prazos Perdidos"
  | "Propostas"
  | "Tentativa de Contato"
  | "Primeiro contato"
  | "Aguardando Documentação"
  | "Análise de Crédito"
  | "Crédito pré-aprovado"
  | "Stand-by"
  | "Perda"
  | "Proposta"
  | "Contrato rodado"
  | "Sucesso";

export const PHASES: Phase[] = [
  "Tentativa de Contato",
  "Atendimentos Agendados",
  "Atendimentos Realizados",
  "Em Atendimento",
  "Em Quarentena",
  "Standby",
  "Propostas",
  "Contratos Assinados",
  "Negócios Perdidos",
  "Prazos Perdidos",
];

/** Fases ativas do funil (sem perdas) */
export const ACTIVE_PHASES: Phase[] = [
  "Tentativa de Contato",
  "Atendimentos Agendados",
  "Atendimentos Realizados",
  "Em Atendimento",
  "Em Quarentena",
  "Standby",
  "Propostas",
  "Contratos Assinados",
];

/** Substatus exibidos dentro do card "Status do atendimento" no funil ativo */
export const ATTENDANCE_STATUS_PHASES: Phase[] = ["Em Quarentena", "Standby"];

export function isAttendanceStatusPhase(phase: Phase): boolean {
  return (ATTENDANCE_STATUS_PHASES as readonly Phase[]).includes(phase);
}

export const ATTENDANCE_STATUS_GROUP_LABEL = "Status do atendimento";

export type ActiveFunnelLegendSection = {
  label: string | null;
  phases: Phase[];
};

/** Seções da legenda do funil ativo (Overview e visão por equipe) */
export const ACTIVE_FUNNEL_LEGEND_SECTIONS: ActiveFunnelLegendSection[] = [
  {
    label: null,
    phases: [
      "Tentativa de Contato",
      "Atendimentos Agendados",
      "Atendimentos Realizados",
      "Em Atendimento",
    ],
  },
  {
    label: ATTENDANCE_STATUS_GROUP_LABEL,
    phases: ATTENDANCE_STATUS_PHASES,
  },
  {
    label: null,
    phases: ["Propostas", "Contratos Assinados"],
  },
];

/** Perdas — exibidas separadas das demais */
export const LOST_PHASES: Phase[] = ["Negócios Perdidos", "Prazos Perdidos"];

/** Fases ativas da esteira Econômico (categoria Bitrix 64) */
export const ECONOMICO_ACTIVE_PHASES: Phase[] = [
  "Primeiro contato",
  "Aguardando Documentação",
  "Análise de Crédito",
  "Crédito pré-aprovado",
  "Sucesso",
  "Em Quarentena",
  "Stand-by",
  "Proposta",
  "Contrato rodado",
];

export const ECONOMICO_LOST_PHASES: Phase[] = ["Perda", "Prazos Perdidos"];

export const ECONOMICO_FUNNEL_LEGEND_SECTIONS: ActiveFunnelLegendSection[] = [
  {
    label: null,
    phases: [
      "Primeiro contato",
      "Aguardando Documentação",
      "Análise de Crédito",
      "Crédito pré-aprovado",
      "Sucesso",
    ],
  },
  {
    label: ATTENDANCE_STATUS_GROUP_LABEL,
    phases: ["Em Quarentena", "Stand-by"],
  },
  {
    label: null,
    phases: ["Proposta", "Contrato rodado"],
  },
];

export function getActivePhases(pipeline: DashboardPipelineKey = "comercial_geral"): Phase[] {
  return pipeline === "economico" ? ECONOMICO_ACTIVE_PHASES : ACTIVE_PHASES;
}

export function getLostPhases(pipeline: DashboardPipelineKey = "comercial_geral"): Phase[] {
  return pipeline === "economico" ? ECONOMICO_LOST_PHASES : LOST_PHASES;
}

export function getFunnelLegendSections(
  pipeline: DashboardPipelineKey = "comercial_geral",
): ActiveFunnelLegendSection[] {
  return pipeline === "economico" ? ECONOMICO_FUNNEL_LEGEND_SECTIONS : ACTIVE_FUNNEL_LEGEND_SECTIONS;
}

/** Todas as fases contabilizadas em um pipeline (ativas + perdas) */
export function getPipelinePhases(pipeline: DashboardPipelineKey = "comercial_geral"): Phase[] {
  return [...getActivePhases(pipeline), ...getLostPhases(pipeline)];
}

export const PHASE_COLORS: Record<Phase, string> = {
  "Atendimentos Agendados": "#7c3aed",
  "Atendimentos Realizados": "#2563eb",
  "Contratos Assinados": "#10b981",
  "Em Atendimento": "#f59e0b",
  "Em Quarentena": "#d97706",
  Standby: "#64748b",
  "Negócios Perdidos": "#ef4444",
  "Prazos Perdidos": "#f97316",
  Propostas: "#06b6d4",
  "Tentativa de Contato": "#14b8a6",
  "Primeiro contato": "#14b8a6",
  "Aguardando Documentação": "#06b6d4",
  "Análise de Crédito": "#3b82f6",
  "Crédito pré-aprovado": "#8b5cf6",
  "Stand-by": "#64748b",
  Perda: "#ef4444",
  Proposta: "#f59e0b",
  "Contrato rodado": "#10b981",
  Sucesso: "#16a34a",
};

export function isLostPhase(p: Phase): boolean {
  return LOST_PHASES.includes(p);
}

/** Rótulos curtos para legendas em painéis estreitos */
export const PHASE_SHORT_LABELS: Record<Phase, string> = {
  "Tentativa de Contato": "Tentativa",
  "Atendimentos Agendados": "Agendados",
  "Atendimentos Realizados": "Realizados",
  "Em Atendimento": "Em atendimento",
  "Em Quarentena": "Em quarentena",
  Standby: "Standby",
  Propostas: "Propostas",
  "Contratos Assinados": "Contratos",
  "Negócios Perdidos": "Negócios perdidos",
  "Prazos Perdidos": "Prazos perdidos",
  "Primeiro contato": "1º contato",
  "Aguardando Documentação": "Aguard. doc.",
  "Análise de Crédito": "Análise créd.",
  "Crédito pré-aprovado": "Pré-aprovado",
  "Stand-by": "Stand-by",
  Perda: "Perda",
  Proposta: "Proposta",
  "Contrato rodado": "Contrato rodado",
  Sucesso: "Sucesso",
};

function normalizeStageName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Normaliza nome de etapa do Bitrix → Phase do dashboard (Comercial Geral) */
export function mapStageToPhase(raw: string | null | undefined): Phase | null {
  if (!raw) return null;
  const n = normalizeStageName(raw);

  const rules: [RegExp, Phase][] = [
    [/prazo\s*perdid/, "Prazos Perdidos"],
    [/negocio\s*perdid|perdid[oa]s?|lose|junk|desqualif/, "Negócios Perdidos"],
    [/contrato\s*assinad|ganh[oa]|won|fechad/, "Contratos Assinados"],
    [/proposta/, "Propostas"],
    [/atendimento\s*realizad|realizad/, "Atendimentos Realizados"],
    [/atendimento\s*agendad|agendad/, "Atendimentos Agendados"],
    [/quarentena/, "Em Quarentena"],
    [/stand\s*-?\s*by|standby/, "Standby"],
    [/em\s*atendimento|atendimento/, "Em Atendimento"],
    [/tentativa|contato|novo|new/, "Tentativa de Contato"],
  ];

  for (const [re, phase] of rules) {
    if (re.test(n)) return phase;
  }
  return null;
}

/** Normaliza nome de etapa do Bitrix → Phase do dashboard (Econômico) */
export function mapStageToEconomicoPhase(raw: string | null | undefined): Phase | null {
  if (!raw) return null;
  const n = normalizeStageName(raw);

  const exact: Record<string, Phase> = {
    "primeiro contato": "Primeiro contato",
    "aguardando documentacao": "Aguardando Documentação",
    "analise de credito": "Análise de Crédito",
    "credito pre-aprovado": "Crédito pré-aprovado",
    "credito pre aprovado": "Crédito pré-aprovado",
    "stand-by": "Stand-by",
    standby: "Stand-by",
    perda: "Perda",
    proposta: "Proposta",
    "contrato rodado": "Contrato rodado",
    contrato: "Contrato rodado",
    sucesso: "Sucesso",
  };
  if (exact[n]) return exact[n];

  const rules: [RegExp, Phase][] = [
    [/prazos?\s*perdid/, "Prazos Perdidos"],
    [/stand\s*-?\s*by|standby/, "Stand-by"],
    [/negocio\s*perdid|perda|perdid[oa]s?|lose|junk|desqualif/, "Perda"],
    [/quarentena/, "Em Quarentena"],
    [/contrato\s*rodad|contrato\s*assinad/, "Contrato rodado"],
    [/credito\s*pre\s*-?\s*aprovad|pre\s*-?\s*aprovad/, "Crédito pré-aprovado"],
    [/sucesso/, "Sucesso"],
    [/ganh[oa]|won|fechad/, "Contrato rodado"],
    [/analise\s*de\s*credit|analise\s*credit/, "Análise de Crédito"],
    [/aguardando\s*document/, "Aguardando Documentação"],
    [/proposta/, "Proposta"],
    [/primeiro\s*contato/, "Primeiro contato"],
    [/contato|novo|new/, "Primeiro contato"],
  ];

  for (const [re, phase] of rules) {
    if (re.test(n)) return phase;
  }
  return null;
}

export function mapStageToPhaseForPipeline(
  raw: string | null | undefined,
  pipeline: DashboardPipelineKey,
): Phase | null {
  return pipeline === "economico" ? mapStageToEconomicoPhase(raw) : mapStageToPhase(raw);
}
