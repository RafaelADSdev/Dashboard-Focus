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
  | "Tentativa de Contato";

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
};

/** Normaliza nome de etapa do Bitrix → Phase do dashboard */
export function mapStageToPhase(raw: string | null | undefined): Phase | null {
  if (!raw) return null;
  const n = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

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
