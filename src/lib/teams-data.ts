import { PHASES, type Phase } from "@/lib/phases";

export type { Phase } from "@/lib/phases";
export { PHASES, ACTIVE_PHASES, LOST_PHASES, PHASE_COLORS, PHASE_SHORT_LABELS, isLostPhase } from "@/lib/phases";

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

export type Member = {
  name: string;
  bitrixId?: string;
  photoUrl?: string;
  matrix: Partial<Record<Phase, Record<MonthKey, number>>>;
};

export type Team = {
  id: string;
  name: string;
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

export function grandTotal(teams: Team[], month: MonthFilter): number {
  return teams.reduce((a, t) => a + teamTotal(t, month), 0);
}

export function monthlyTrend(teams: Team[]): { month: MonthKey; value: number }[] {
  return MONTHS.map((m) => ({ month: m, value: grandTotal(teams, m) }));
}

const mk = (name: string, values: (number | null)[]): Member => {
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
  return { name, matrix };
};

const elite: Member[] = [
  mk("Amauri Monteiro", [5, null, 1, 6, 46, 70, null, 1]),
  mk("Erveson José de Santana", [null, null, null, null, null, 9, null, null]),
  mk("José Fernando Gomes da Silva", [10, 21, null, 5, 191, 115, null, 2]),
  mk("Leonardo Zeni", [null, 8, 1, 9, 114, 66, 1, 11]),
  mk("Marianna Queiroz Rosal", [null, null, null, null, 4, 48, null, null]),
];

const lider: Member[] = [
  mk("Adauto Anderson Lins dos Anjos", [50, 12, 22, 14, 884, 265, null, 19]),
  mk("Diana Patriota", [null, null, null, null, 22, 1, null, null]),
  mk("Erika Munnizia Barbosa Macedo", [10, 3, null, 55, 399, 89, null, 10]),
  mk("Felipe Trancoso", [null, null, null, null, 1, null, null, null]),
  mk("Guilherme José Dubeux Dourado", [null, null, null, null, 18, 4, null, null]),
  mk("Guilherme Paes Riscado", [null, null, 1, null, 267, 122, null, null]),
  mk("Henry Heimer", [3, 7, 2, 10, 590, 685, 2, 13]),
  mk("Ibrain Lima Almeida Júnior", [null, null, null, null, 58, null, null, null]),
  mk("Jullia de Lima", [null, null, null, null, 151, 56, null, null]),
  mk("Maria Cinthya de Brito Nascimento", [null, null, null, null, 26, 66, null, null]),
  mk("Maria José Toscano", [null, 1, 4, 14, 537, 295, null, 3]),
  mk("Morgana Toscano Gomes", [null, null, null, null, 102, 79, null, null]),
  mk("Rafaela Góes", [null, null, 1, 1, 5, 1, null, null]),
  mk("Ricardo Dantas Pacheco", [2, null, 1, null, 246, 187, null, null]),
  mk("Vanessa Maciel", [null, null, null, null, 22, null, null, null]),
];

const total: Member[] = [
  mk("Adriano Cardoso", [null, 4, null, null, 329, 217, null, null]),
  mk("Allan Pedro Machado", [null, null, null, null, 248, 83, null, null]),
  mk("Anderson Soares Cabral", [null, null, null, 7, 8, 6, null, 1]),
  mk("Carla Patrícia de Melo Albuquerque", [null, 1, 1, 5, 39, 66, null, 1]),
  mk("Carol Mello", [null, null, null, null, 28, 57, null, null]),
  mk("Elizabeth Pereira", [null, null, null, null, 24, 49, null, null]),
  mk("Ileci Macedo", [null, null, null, null, 41, 44, null, null]),
  mk("Janaina Oliveira Estevão", [null, null, null, null, 61, null, null, null]),
  mk("Luana Rodrigues", [null, null, null, null, 71, null, null, null]),
  mk("Lucelma Santos", [null, null, 1, null, 109, null, null, null]),
  mk("Luciano Lima de Barros", [null, 1, 7, null, 220, 142, null, null]),
  mk("Matheus Caldas", [null, null, 1, null, 465, 120, null, null]),
  mk("Nilo Fernandez Cirqueira", [null, null, null, null, 3, 4, null, null]),
  mk("Rafael Costa de Moraes", [null, null, null, null, 1, null, null, null]),
  mk("Rayana Maria Vanderlei Costa", [6, 1, 13, 11, 668, 380, 1, 28]),
  mk("Rozeli Ferreira Mota", [null, null, null, null, 16, 8, null, null]),
  mk("Thales Costa Caribé Venceslau", [1, null, null, 7, 6, 34, null, 17]),
  mk("Thatianne Almeida Marroquim", [null, null, 1, null, 77, null, null, null]),
];

/** Fallback local quando BITRIX_WEBHOOK_URL não está definida */
export const STATIC_TEAMS: Team[] = [
  { id: "elite", name: "Focus Elite", members: elite },
  { id: "lider", name: "Focus Líder", members: lider },
  { id: "total", name: "Focus Total", members: total },
];

/** @deprecated use dados do loader; mantido para compat */
export const TEAMS = STATIC_TEAMS;

export const TEAM_ACCENT: Record<string, string> = {
  elite: "from-sky-500 to-cyan-400",
  lider: "from-emerald-500 to-teal-500",
  total: "from-amber-500 to-orange-500",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
