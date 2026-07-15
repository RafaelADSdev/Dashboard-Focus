import { ACTIVE_PHASES, PHASES, type Phase } from "@/lib/phases";

export type { Phase } from "@/lib/phases";
export { PHASES, ACTIVE_PHASES, LOST_PHASES, PHASE_COLORS, PHASE_SHORT_LABELS, isLostPhase, ATTENDANCE_STATUS_PHASES, ATTENDANCE_STATUS_GROUP_LABEL, ACTIVE_FUNNEL_LEGEND_SECTIONS } from "@/lib/phases";

// Ano-calendário completo: o filtro do webhook limita os registros a 2026.
export const MONTHS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;
export type MonthKey = (typeof MONTHS)[number];
export const MONTH_LABELS: Record<MonthKey, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

export type MonthFilter = "all" | MonthKey;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Dados estáticos: concentra o total em 1–2 meses reais (os demais ficam em branco).
 * Com webhook Bitrix, os meses vêm da DATE_CREATE — sem leads = mês vazio.
 */
function sparseMonths(value: number, seed: string): Record<MonthKey, number> {
  const out = {} as Record<MonthKey, number>;
  if (!value || value <= 0) return out;

  const primary = MONTHS[hash(seed) % MONTHS.length];
  const useSecond = value > 8 && hash(seed + "|2") % 3 === 0;
  const secondary = MONTHS[hash(seed + "|m") % MONTHS.length];

  if (!useSecond || secondary === primary) {
    out[primary] = value;
    return out;
  }

  const a = Math.max(1, Math.floor(value * 0.65));
  out[primary] = a;
  out[secondary] = value - a;
  return out;
}

export function normalizeMemberName(value: string): string {
  try {
    return value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

/** Colaboradores atuais nos departamentos Focus (Bitrix). Quem não está aqui = saiu da equipe. */
export const FOCUS_ACTIVE_BY_TEAM: Record<string, readonly string[]> = {
  elite: [
    "Marianna Queiroz Rosal",
    "Amauri Monteiro",
    "José Fernando Gomes da Silva",
    "Leonardo Zeni",
  ],
  lider: [
    "Rafaela Góes",
    "Erika Munnizia Barbosa Macedo",
    "Henry Heimer",
    "Ricardo Dantas Pacheco",
    "Adauto Anderson Lins dos Anjos",
    "Maria José Toscano",
  ],
  total: [
    "Carol Mello",
    "Thales Costa Caribé Venceslau",
    "Anderson Soares Cabral",
    "Carla Patrícia de Melo Albuquerque",
    "Rozeli Ferreira Mota",
    "Adriano Cardoso",
    "Rayana Maria Vanderlei Costa",
  ],
};

const FOCUS_ACTIVE_LOOKUP = Object.fromEntries(
  Object.entries(FOCUS_ACTIVE_BY_TEAM).map(([teamId, names]) => [
    teamId,
    new Set(names.map(normalizeMemberName)),
  ]),
) as Record<string, Set<string>>;

export function isFocusActiveMember(teamId: string, name: string): boolean {
  return FOCUS_ACTIVE_LOOKUP[teamId]?.has(normalizeMemberName(name)) ?? false;
}

export type Member = {
  name: string;
  bitrixId?: string;
  photoUrl?: string;
  /** false = saiu da equipe Focus; nome exibido em cinza no painel */
  active?: boolean;
  matrix: Partial<Record<Phase, Record<MonthKey, number>>>;
};

export type Team = {
  id: string;
  name: string;
  leader?: {
    name: string;
    bitrixId?: string;
    photoUrl?: string;
  };
  members: Member[];
};

export function memberPhaseValue(m: Member, p: Phase, month: MonthFilter): number {
  const byMonth = m.matrix[p];
  if (!byMonth) return 0;
  if (month === "all") return MONTHS.reduce((a, mo) => a + (byMonth[mo] ?? 0), 0);
  return byMonth[month] ?? 0;
}

export function memberTotal(m: Member, month: MonthFilter): number {
  return PHASES.reduce((a, p) => a + memberPhaseValue(m, p, month), 0);
}

export function memberActiveTotal(m: Member, month: MonthFilter): number {
  return PHASES.filter((p) => p !== "Negócios Perdidos" && p !== "Prazos Perdidos").reduce(
    (a, p) => a + memberPhaseValue(m, p, month),
    0,
  );
}

export function teamPhaseTotal(t: Team, p: Phase, month: MonthFilter): number {
  return t.members.reduce((a, m) => a + memberPhaseValue(m, p, month), 0);
}

export function teamTotal(t: Team, month: MonthFilter): number {
  return t.members.reduce((a, m) => a + memberTotal(m, month), 0);
}

export function teamActiveTotal(t: Team, month: MonthFilter): number {
  return ACTIVE_PHASES.reduce((a, p) => a + teamPhaseTotal(t, p, month), 0);
}

export function grandTotal(teams: Team[], month: MonthFilter): number {
  return teams.reduce((a, t) => a + teamTotal(t, month), 0);
}

export function grandActiveTotal(teams: Team[], month: MonthFilter): number {
  return teams.reduce((a, t) => a + teamActiveTotal(t, month), 0);
}

export function monthlyTrend(teams: Team[]): { month: MonthKey; value: number }[] {
  return MONTHS.map((m) => ({ month: m, value: grandTotal(teams, m) }));
}

const mk = (teamId: string, name: string, values: (number | null)[]): Member => {
  const matrix: Member["matrix"] = {};
  // Ordem colunas histórica: Agendados, Realizados, Contratos, Em Atendimento, Perdidos, Prazos, Propostas, Tentativa
  const order: Phase[] = [
    "Atendimentos Agendados",
    "Atendimentos Realizados",
    "Contratos Assinados",
    "Em Atendimento",
    "Negócios Perdidos",
    "Prazos Perdidos",
    "Propostas",
    "Tentativa de Contato",
  ];
  order.forEach((p, i) => {
    const v = values[i];
    if (v && v > 0) matrix[p] = sparseMonths(v, name + "|" + p);
  });
  return {
    name,
    active: isFocusActiveMember(teamId, name),
    matrix,
  };
};

const elite: Member[] = [
  mk("elite", "Amauri Monteiro", [5, null, 1, 6, 46, 70, null, 1]),
  mk("elite", "Erveson José de Santana", [null, null, null, null, null, 9, null, null]),
  mk("elite", "José Fernando Gomes da Silva", [10, 21, null, 5, 191, 115, null, 2]),
  mk("elite", "Leonardo Zeni", [null, 8, 1, 9, 114, 66, 1, 11]),
  mk("elite", "Marianna Queiroz Rosal", [null, null, null, null, 4, 48, null, null]),
];

const lider: Member[] = [
  mk("lider", "Adauto Anderson Lins dos Anjos", [50, 12, 22, 14, 884, 265, null, 19]),
  mk("lider", "Diana Patriota", [null, null, null, null, 22, 1, null, null]),
  mk("lider", "Erika Munnizia Barbosa Macedo", [10, 3, null, 55, 399, 89, null, 10]),
  mk("lider", "Felipe Trancoso", [null, null, null, null, 1, null, null, null]),
  mk("lider", "Guilherme José Dubeux Dourado", [null, null, null, null, 18, 4, null, null]),
  mk("lider", "Guilherme Paes Riscado", [null, null, 1, null, 267, 122, null, null]),
  mk("lider", "Henry Heimer", [3, 7, 2, 10, 590, 685, 2, 13]),
  mk("lider", "Ibrain Lima Almeida Júnior", [null, null, null, null, 58, null, null, null]),
  mk("lider", "Jullia de Lima", [null, null, null, null, 151, 56, null, null]),
  mk("lider", "Maria Cinthya de Brito Nascimento", [null, null, null, null, 26, 66, null, null]),
  mk("lider", "Maria José Toscano", [null, 1, 4, 14, 537, 295, null, 3]),
  mk("lider", "Morgana Toscano Gomes", [null, null, null, null, 102, 79, null, null]),
  mk("lider", "Rafaela Góes", [null, null, 1, 1, 5, 1, null, null]),
  mk("lider", "Ricardo Dantas Pacheco", [2, null, 1, null, 246, 187, null, null]),
  mk("lider", "Vanessa Maciel", [null, null, null, null, 22, null, null, null]),
];

const total: Member[] = [
  mk("total", "Adriano Cardoso", [null, 4, null, null, 329, 217, null, null]),
  mk("total", "Allan Pedro Machado", [null, null, null, null, 248, 83, null, null]),
  mk("total", "Anderson Soares Cabral", [null, null, null, 7, 8, 6, null, 1]),
  mk("total", "Carla Patrícia de Melo Albuquerque", [null, 1, 1, 5, 39, 66, null, 1]),
  mk("total", "Carol Mello", [null, null, null, null, 28, 57, null, null]),
  mk("total", "Elizabeth Pereira", [null, null, null, null, 24, 49, null, null]),
  mk("total", "Ileci Macedo", [null, null, null, null, 41, 44, null, null]),
  mk("total", "Janaina Oliveira Estevão", [null, null, null, null, 61, null, null, null]),
  mk("total", "Luana Rodrigues", [null, null, null, null, 71, null, null, null]),
  mk("total", "Lucelma Santos", [null, null, 1, null, 109, null, null, null]),
  mk("total", "Luciano Lima de Barros", [null, 1, 7, null, 220, 142, null, null]),
  mk("total", "Matheus Caldas", [null, null, 1, null, 465, 120, null, null]),
  mk("total", "Nilo Fernandez Cirqueira", [null, null, null, null, 3, 4, null, null]),
  mk("total", "Rafael Costa de Moraes", [null, null, null, null, 1, null, null, null]),
  mk("total", "Rayana Maria Vanderlei Costa", [6, 1, 13, 11, 668, 380, 1, 28]),
  mk("total", "Rozeli Ferreira Mota", [null, null, null, null, 16, 8, null, null]),
  mk("total", "Thales Costa Caribé Venceslau", [1, null, null, 7, 6, 34, null, 17]),
  mk("total", "Thatianne Almeida Marroquim", [null, null, 1, null, 77, null, null, null]),
];

/** Fallback local quando BITRIX_WEBHOOK_URL não está definida */
export const TEAM_LEADER_NAMES: Record<string, string> = {
  elite: "Marianna Queiroz Rosal",
  lider: "Rafaela Góes",
  total: "Carol Mello",
};

export const STATIC_TEAMS: Team[] = [
  {
    id: "elite",
    name: "Focus Elite",
    leader: { name: TEAM_LEADER_NAMES.elite },
    members: elite,
  },
  {
    id: "lider",
    name: "Focus Líder",
    leader: { name: TEAM_LEADER_NAMES.lider },
    members: lider,
  },
  {
    id: "total",
    name: "Focus Total",
    leader: { name: TEAM_LEADER_NAMES.total },
    members: total,
  },
];

/** @deprecated use dados do loader; mantido para compat */
export const TEAMS = STATIC_TEAMS;

export const TEAM_ACCENT: Record<string, string> = {
  elite: "from-violet-600 to-purple-400",
  lider: "from-emerald-500 to-teal-500",
  total: "from-amber-500 to-orange-500",
  imparaveis: "from-sky-500 to-blue-500",
  domina: "from-rose-500 to-pink-500",
  legado: "from-indigo-500 to-violet-500",
  lobos: "from-slate-500 to-zinc-500",
};

/** Lavagem suave de fundo para cards compactos da esteira Econômico */
export const TEAM_ACCENT_SOFT: Record<string, string> = {
  elite: "from-violet-500/10 via-white to-white",
  lider: "from-emerald-500/10 via-white to-white",
  total: "from-amber-500/10 via-white to-white",
  imparaveis: "from-sky-500/10 via-white to-white",
  domina: "from-rose-500/10 via-white to-white",
  legado: "from-indigo-500/10 via-white to-white",
  lobos: "from-slate-500/10 via-white to-white",
};

/** Gradiente translúcido para o card do líder (glassmorphism por equipe) */
export const TEAM_HERO_GLASS: Record<string, string> = {
  elite: "from-violet-500/24 via-white/42 to-white/16",
  lider: "from-emerald-500/24 via-white/42 to-white/16",
  total: "from-amber-500/24 via-white/42 to-white/16",
  imparaveis: "from-sky-500/24 via-white/42 to-white/16",
  domina: "from-rose-500/24 via-white/42 to-white/16",
  legado: "from-indigo-500/24 via-white/42 to-white/16",
  lobos: "from-slate-500/24 via-white/42 to-white/16",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
