export type Phase =
  | "Atendimentos Agendados"
  | "Atendimentos Realizados"
  | "Contratos Assinados"
  | "Em Atendimento"
  | "Negócios Perdidos"
  | "Prazos Perdidos"
  | "Propostas"
  | "Tentativa de Contato";

export const PHASES: Phase[] = [
  "Tentativa de Contato",
  "Atendimentos Agendados",
  "Atendimentos Realizados",
  "Em Atendimento",
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
  "Propostas",
  "Contratos Assinados",
];

/** Perdas — exibidas separadas das demais */
export const LOST_PHASES: Phase[] = ["Negócios Perdidos", "Prazos Perdidos"];

export const PHASE_COLORS: Record<Phase, string> = {
  "Atendimentos Agendados": "#6366f1",
  "Atendimentos Realizados": "#0ea5e9",
  "Contratos Assinados": "#10b981",
  "Em Atendimento": "#f59e0b",
  "Negócios Perdidos": "#ef4444",
  "Prazos Perdidos": "#f97316",
  Propostas: "#8b5cf6",
  "Tentativa de Contato": "#14b8a6",
};

export function isLostPhase(p: Phase): boolean {
  return LOST_PHASES.includes(p);
}

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
    [/em\s*atendimento|atendimento/, "Em Atendimento"],
    [/tentativa|contato|novo|new/, "Tentativa de Contato"],
  ];

  for (const [re, phase] of rules) {
    if (re.test(n)) return phase;
  }
  return null;
}
